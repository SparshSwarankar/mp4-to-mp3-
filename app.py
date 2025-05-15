from flask import Flask, request, send_file, jsonify, after_this_request, make_response, render_template, send_from_directory
from werkzeug.utils import secure_filename
from flask_cors import CORS
import os
import tempfile
import subprocess
from io import BytesIO
import zipfile

app = Flask(__name__, template_folder='templates', static_folder='static')
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)  # Ensure CORS for all routes and errors

app.config['MAX_CONTENT_LENGTH'] = 1024 * 1024 * 1024  # 1GB max upload

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/tools')
def tools():
    return render_template('tools.html')

@app.route('/contact')
def contact():
    return render_template('contact.html')

@app.route('/static/<path:path>')
def static_files(path):
    return send_from_directory('static', path)

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

    # Accept both single and multiple files
    files = request.files.getlist('file')
    if not files or files[0].filename == '':
        resp = jsonify({'error': 'No file(s) uploaded'})
        resp.headers['Access-Control-Allow-Origin'] = '*'
        return resp, 400

    # Validate all files
    for file in files:
        if not file.filename.lower().endswith('.mp4'):
            resp = jsonify({'error': 'Only MP4 files are allowed'})
            resp.headers['Access-Control-Allow-Origin'] = '*'
            return resp, 400

    with tempfile.TemporaryDirectory() as tmpdir:
        mp3_paths = []
        for file in files:
            filename = secure_filename(file.filename)
            mp4_path = os.path.join(tmpdir, filename)
            mp3_path = os.path.join(tmpdir, filename.rsplit('.', 1)[0] + '.mp3')
            file.save(mp4_path)
            try:
                result = subprocess.run(
                    [
                        'ffmpeg', '-y', '-loglevel', 'error', '-i', mp4_path, '-vn', '-acodec', 'libmp3lame', '-ab', '192k', mp3_path
                    ],
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE
                )
                print(f"Converting: {mp4_path} -> {mp3_path}, returncode={result.returncode}")
                if result.returncode != 0 or not os.path.exists(mp3_path):
                    print(f"Failed: {filename}, stderr={result.stderr.decode()}")
                else:
                    mp3_paths.append(mp3_path)
            except Exception as e:
                print(f"Exception for {filename}: {e}")

        print("MP3s created:", mp3_paths)

        # If only one file, return as before
        if len(mp3_paths) == 1:
            with open(mp3_paths[0], 'rb') as f:
                mp3_data = f.read()

            @after_this_request
            def cleanup(response):
                try:
                    for path in mp3_paths:
                        if os.path.exists(path):
                            os.remove(path)
                except Exception as cleanup_err:
                    print("Cleanup error:", cleanup_err)
                return response

            response = send_file(
                BytesIO(mp3_data),
                as_attachment=True,
                download_name=os.path.basename(mp3_paths[0]),
                mimetype='audio/mpeg'
            )
            response.headers['Access-Control-Allow-Origin'] = '*'
            response.headers['Access-Control-Allow-Credentials'] = 'true'
            response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
            response.headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
            return response

        # If multiple files, zip them
        if len(mp3_paths) > 1:
            zip_buffer = BytesIO()
            with zipfile.ZipFile(zip_buffer, 'w') as zipf:
                for mp3_path in mp3_paths:
                    zipf.write(mp3_path, arcname=os.path.basename(mp3_path))
            zip_buffer.seek(0)

            @after_this_request
            def cleanup(response):
                try:
                    for path in mp3_paths:
                        if os.path.exists(path):
                            os.remove(path)
                except Exception as cleanup_err:
                    print("Cleanup error:", cleanup_err)
                return response

            response = send_file(
                zip_buffer,
                as_attachment=True,
                download_name=f'converted_{len(mp3_paths)}_mp3s.zip',
                mimetype='application/zip'
            )
            response.headers['Access-Control-Allow-Origin'] = '*'
            response.headers['Access-Control-Allow-Credentials'] = 'true'
            response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
            response.headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
            response.headers['Content-Disposition'] = f'attachment; filename=converted_{len(mp3_paths)}_mp3s.zip'
            response.headers['Content-Type'] = 'application/zip'
            return response

        # If no MP3s were created, return error
        resp = jsonify({'error': 'No files were converted. Please check your input files.'})
        resp.headers['Access-Control-Allow-Origin'] = '*'
        return resp, 500

@app.route('/')
def index():
    return 'MP4 to MP3 backend is running.'

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000,debug=True)
