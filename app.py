from flask import Flask, request, send_file, jsonify, after_this_request, make_response, render_template, send_from_directory
from werkzeug.utils import secure_filename
from flask_cors import CORS
import os
import tempfile
import subprocess
from io import BytesIO
import zipfile
import logging
import datetime
import shutil
import json

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

# Create a file handler
file_handler = logging.FileHandler('file_operations.log')
file_handler.setLevel(logging.INFO)
formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
file_handler.setFormatter(formatter)
logger.addHandler(file_handler)

app = Flask(__name__, template_folder='templates', static_folder='static')
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)

# Configuration
if os.environ.get("RENDER"):
    app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024  # 100MB for Render
else:
    app.config['MAX_CONTENT_LENGTH'] = 1024 * 1024 * 1024  # 1GB for local
app.config['UPLOAD_FOLDER'] = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads')
app.config['CONVERTED_FOLDER'] = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'converted')

# Create upload and converted folders if they don't exist
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs(app.config['CONVERTED_FOLDER'], exist_ok=True)

# Allowed extensions for audio enhancement
ALLOWED_EXTENSIONS = {'mp3', 'wav'}

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def has_audio_stream(input_path):
    """Return True if the file has an audio stream, else False."""
    try:
        result = subprocess.run(
            [
                'ffprobe', '-v', 'error', '-select_streams', 'a',
                '-show_entries', 'stream=codec_type',
                '-of', 'json', input_path
            ],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        info = json.loads(result.stdout.decode())
        return 'streams' in info and len(info['streams']) > 0
    except Exception as e:
        return False

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/about')
def about():
    return render_template('about.html')

@app.route('/tools')
def tools():
    return render_template('tools.html')

@app.route('/contact')
def contact():
    return render_template('contact.html')

@app.route('/static/<path:filename>')
def static_files(filename):
    return send_from_directory('static', filename)

@app.errorhandler(Exception)    
def handle_error(e):
    # Always return CORS headers on errors
    response = jsonify({'error': str(e)})
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Credentials'] = 'true'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    response.headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
    return response, 500

@app.route('/convert', methods=['POST', 'OPTIONS'])
def convert():
    if request.method == 'OPTIONS':
        # CORS preflight support
        response = make_response()
        response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
        response.headers['Access-Control-Allow-Credentials'] = 'true'
        return response

    files = request.files.getlist('file')
    if not files or files[0].filename == '':
        resp = jsonify({'error': 'No file(s) uploaded'})
        resp.headers['Access-Control-Allow-Origin'] = '*'
        return resp, 400

    # Validate all files (allow MP4 and MKV)
    for file in files:
        if not (file.filename.lower().endswith('.mp4') or file.filename.lower().endswith('.mkv')):
            resp = jsonify({'error': 'Only MP4 and MKV files are allowed'})
            resp.headers['Access-Control-Allow-Origin'] = '*'
            return resp, 400

    mp3_paths = []
    uploaded_files = []

    try:
        # Save uploaded files
        for file in files:
            filename = secure_filename(file.filename)
            input_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            file.save(input_path)
            uploaded_files.append(input_path)

            # --- ADD THIS CHECK ---
            if not has_audio_stream(input_path):
                logger.error(f"No audio stream found in {filename}")
                print(f"No audio stream found in {filename}")
                continue  # Skip this file

            print("\n" + "="*50)
            print("File Upload Details:")
            print("="*50)
            print(f"File Name: {filename}")
            print(f"Upload Path: {input_path}")
            print(f"Size: {os.path.getsize(input_path)/1024:.2f} KB")
            print(f"Upload Time: {datetime.datetime.now()}")
            print("="*50 + "\n")
            
            # Convert the file (support both MP4 and MKV as input)
            # Output filename: converted_<originalname>.mp3
            base_name = os.path.splitext(filename)[0]
            mp3_filename = f"converted_{base_name}.mp3"
            mp3_path = os.path.join(app.config['CONVERTED_FOLDER'], mp3_filename)

            try:
                result = subprocess.run(
                    [
                        'ffmpeg', '-y', '-loglevel', 'error',
                        '-i', input_path,
                        '-vn', '-acodec', 'libmp3lame',
                        '-ab', '192k',
                        mp3_path
                    ],
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE
                )
                
                print("\n" + "="*50)
                print("File Processing Details:")
                print("="*50)
                print(f"Input File: {filename}")
                print(f"Status: {'Success' if result.returncode == 0 else 'Failed'}")
                print(f"Input Path: {input_path}")
                print(f"Output Path: {mp3_path}")
                print(f"Return Code: {result.returncode}")
                if result.stderr:
                    print(f"Error Output: {result.stderr.decode()}")
                print("="*50 + "\n")

                if result.returncode == 0 and os.path.exists(mp3_path):
                    mp3_paths.append(mp3_path)
                    logger.info(f"Successfully converted: {filename}")
                else:
                    logger.error(f"Conversion failed for {filename}")
                    print(f"Failed: {filename}, stderr={result.stderr.decode()}")
            except Exception as e:
                logger.error(f"Exception during conversion of {filename}: {e}")
                print(f"Exception for {filename}: {e}")

        print("\n" + "="*50)
        print("Conversion Summary:")
        print("="*50)
        print(f"Total files processed: {len(files)}")
        print(f"Successfully converted: {len(mp3_paths)}")
        print(f"Failed conversions: {len(files) - len(mp3_paths)}")
        print("="*50 + "\n")

        # If no MP3s were created, return error
        if not mp3_paths:
            # Clean up uploaded files
            for path in uploaded_files:
                if os.path.exists(path):
                    os.remove(path)
            resp = jsonify({'error': 'No files were converted. Please check your input files.'})
            resp.headers['Access-Control-Allow-Origin'] = '*'
            return resp, 500

        # Handle single file response
        if len(mp3_paths) == 1:
            with open(mp3_paths[0], 'rb') as f:
                mp3_data = f.read()

            @after_this_request
            def cleanup(response):
                try:
                    # Clean up the uploaded MP4 file
                    for path in uploaded_files:
                        if os.path.exists(path):
                            print("\n" + "="*50)
                            print("MP4 File Deletion Details:")
                            print("="*50)
                            print(f"Deleting: {os.path.basename(path)}")
                            print(f"Location: {path}")
                            print(f"Size: {os.path.getsize(path)/1024:.2f} KB")
                            print(f"Timestamp: {datetime.datetime.now()}")
                            os.remove(path)
                            print("Status: Successfully deleted MP4")
                            print("="*50 + "\n")

                    # Clean up the converted MP3 file
                    for path in mp3_paths:
                        if os.path.exists(path):
                            print("\n" + "="*50)
                            print("MP3 File Deletion Details:")
                            print("="*50)
                            print(f"Deleting: {os.path.basename(path)}")
                            print(f"Location: {path}")
                            print(f"Size: {os.path.getsize(path)/1024:.2f} KB")
                            print(f"Timestamp: {datetime.datetime.now()}")
                            os.remove(path)
                            print("Status: Successfully deleted MP3")
                            print("="*50 + "\n")

                except Exception as cleanup_err:
                    print("\n" + "="*50)
                    print("File Deletion Error:")
                    print("="*50)
                    print(f"Error: {cleanup_err}")
                    print(f"Timestamp: {datetime.datetime.now()}")
                    print("="*50 + "\n")
                    logger.error(f"Error during file cleanup: {cleanup_err}")
                return response

            response = send_file(
                BytesIO(mp3_data),
                as_attachment=True,
                download_name=os.path.basename(mp3_paths[0]),
                mimetype='audio/mpeg'
            )
            # Explicitly set Content-Disposition for all browsers
            response.headers["Content-Disposition"] = f'attachment; filename="{os.path.basename(mp3_paths[0])}"'
            response.headers['Access-Control-Allow-Origin'] = '*'
            response.headers['Access-Control-Allow-Credentials'] = 'true'
            response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
            response.headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
            return response

        # Handle multiple files (ZIP)
        zip_buffer = BytesIO()
        with zipfile.ZipFile(zip_buffer, 'w') as zipf:
            for mp3_path in mp3_paths:
                zipf.write(mp3_path, arcname=os.path.basename(mp3_path))
        zip_buffer.seek(0)

        @after_this_request
        def cleanup(response):
            try:
                # Clean up the uploaded MP4 files
                for path in uploaded_files:
                    if os.path.exists(path):
                        print("\n" + "="*50)
                        print("MP4 File Deletion Details:")
                        print("="*50)
                        print(f"Deleting: {os.path.basename(path)}")
                        print(f"Location: {path}")
                        print(f"Size: {os.path.getsize(path)/1024:.2f} KB")
                        print(f"Timestamp: {datetime.datetime.now()}")
                        os.remove(path)
                        print("Status: Successfully deleted MP4")
                        print("="*50 + "\n")

                # Clean up the converted MP3 files
                for path in mp3_paths:
                    if os.path.exists(path):
                        print("\n" + "="*50)
                        print("MP3 File Deletion Details:")
                        print("="*50)
                        print(f"Deleting: {os.path.basename(path)}")
                        print(f"Location: {path}")
                        print(f"Size: {os.path.getsize(path)/1024:.2f} KB")
                        print(f"Timestamp: {datetime.datetime.now()}")
                        os.remove(path)
                        print("Status: Successfully deleted MP3")
                        print("="*50 + "\n")

            except Exception as cleanup_err:
                print("\n" + "="*50)
                print("File Deletion Error:")
                print("="*50)
                print(f"Error: {cleanup_err}")
                print(f"Timestamp: {datetime.datetime.now()}")
                print("="*50 + "\n")
                logger.error(f"Error during file cleanup: {cleanup_err}")
            return response

        response = send_file(
            zip_buffer,
            as_attachment=True,
            download_name=f'converted_{len(mp3_paths)}_mp3s.zip',
            mimetype='application/zip'
        )
        response.headers["Content-Disposition"] = f'attachment; filename="converted_{len(mp3_paths)}_mp3s.zip"'
        response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['Access-Control-Allow-Credentials'] = 'true'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
        response.headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
        return response

    except Exception as e:
        import traceback
        tb = traceback.format_exc()
        logger.error(f"Error during conversion process: {e}\n{tb}")
        print("Conversion error:", e)
        print(tb)
        # Add this to return the error to the frontend for debugging
        resp = jsonify({'error': str(e), 'traceback': tb})
        resp.headers['Access-Control-Allow-Origin'] = '*'
        return resp, 500

@app.route('/audio-enhancer')
def audio_enhancer():
    return render_template('audio_enhancer.html')

@app.route('/enhance', methods=['POST'])
def enhance_audio():
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    if not allowed_file(file.filename):
        return jsonify({'error': 'Unsupported file type. Only MP3 and WAV are allowed.'}), 400
    
    # Get enhancement options
    volume_boost = request.form.get('volumeBoost') == 'true'
    noise_reduction = request.form.get('noiseReduction') == 'true'
    bass_treble = int(request.form.get('bassTreble', 0))
    
    input_path = ""
    output_path = ""

    try:
        # Save uploaded file
        filename = secure_filename(file.filename)
        input_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(input_path)

        # Output filename: enhanced_<originalname>.<ext>
        base_name, ext = os.path.splitext(filename)
        output_filename = f"enhanced_{base_name}{ext}"
        output_path = os.path.join(app.config['CONVERTED_FOLDER'], output_filename)
        
        # Build FFmpeg filter chain
        filters = []
        if volume_boost:
            filters.append('volume=1.5')
        if noise_reduction:
            filters.append('afftdn=nf=-25')
        if bass_treble != 0:
            db_adjust = (bass_treble / 10) * 6
            filters.append(f'equalizer=f=1000:width_type=h:width=200:g={db_adjust}')
        
        ffmpeg_cmd = ['ffmpeg', '-y', '-i', input_path]
        if filters:
            ffmpeg_cmd.extend(['-af', ','.join(filters)])
        ffmpeg_cmd.append(output_path)
        
        # Log the command for debugging
        print("Running FFmpeg command:", " ".join(ffmpeg_cmd))
        
        # Run FFmpeg command
        result = subprocess.run(
            ffmpeg_cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        
        if result.returncode != 0:
            print("FFmpeg stderr:", result.stderr.decode())
            raise Exception(f'Audio enhancement failed: {result.stderr.decode()}')
        
        # Return enhanced file
        response = send_file(
            output_path,
            as_attachment=True,
            download_name=output_filename,
            mimetype='audio/mpeg'
        )
        response.headers["Content-Disposition"] = f'attachment; filename="{output_filename}"'
        return response
    except Exception as e:
        # Clean up files in case of error
        if os.path.exists(input_path):
            os.remove(input_path)
        if os.path.exists(output_path):
            os.remove(output_path)
        
        print("Enhance error:", str(e))  # Log the error for debugging
        return jsonify({'error': str(e)}), 500

@app.route('/trim-audio', methods=['POST'])
def trim_audio():
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400

    # Only allow MP3 files
    if not (file.filename.lower().endswith('.mp3') or file.mimetype in ['audio/mp3', 'audio/mpeg']):
        return jsonify({'error': 'Only MP3 files are allowed.'}), 400

    start = request.form.get('start', '0')
    end = request.form.get('end', None)
    if end is None:
        return jsonify({'error': 'End time required'}), 400

    try:
        start_float = float(start)
        end_float = float(end)
        if end_float <= start_float:
            return jsonify({'error': 'End time must be greater than start time.'}), 400
        if end_float - start_float < 0.1:
            return jsonify({'error': 'Trim duration too short. Please select a longer range.'}), 400
    except Exception as e:
        return jsonify({'error': f'Invalid start/end time: {e}'}), 400

    filename = secure_filename(file.filename)
    input_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    file.save(input_path)

    # Output filename: trimmed_<originalname>.mp3
    base_name = os.path.splitext(filename)[0]
    output_filename = f"trimmed_{base_name}.mp3"
    output_path = os.path.join(app.config['CONVERTED_FOLDER'], output_filename)

    try:
        ffmpeg_cmd = [
            'ffmpeg', '-y',
            '-ss', str(start), '-to', str(end),
            '-accurate_seek', '-avoid_negative_ts', '1',
            '-i', input_path,
            '-acodec', 'libmp3lame', '-ab', '192k',
            output_path
        ]
        result = subprocess.run(ffmpeg_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        if result.returncode != 0:
            error_msg = result.stderr.decode()
            return jsonify({'error': f"FFmpeg failed: {error_msg}"}), 500

        # Ensure file is closed before attempting to delete it in finally
        with open(output_path, 'rb') as f:
            data = f.read()

        response = send_file(
            BytesIO(data),
            as_attachment=True,
            download_name=output_filename,
            mimetype='audio/mpeg'
        )
        response.headers["Content-Disposition"] = f'attachment; filename="{output_filename}"'
        return response

    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        import time
        time.sleep(0.1)
        try:
            if os.path.exists(input_path):
                os.remove(input_path)
        except Exception as e:
            pass
        try:
            if os.path.exists(output_path):
                os.remove(output_path)
        except Exception as e:
            pass

@app.route('/audio-trimmer')
def audio_trimmer():
    return render_template('audio_trimmer.html')

if __name__ == '__main__':
    import signal
    import sys

    def handle_sigint(sig, frame):
        print("\nGracefully shutting down server...")
        sys.exit(0)

    signal.signal(signal.SIGINT, handle_sigint)
    app.run(host='0.0.0.0', port=5000, debug=True)
