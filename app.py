# ...existing code from convert_backend.py, updated as needed...
from flask import Flask, request, send_file, jsonify, after_this_request, make_response, render_template, send_from_directory
from werkzeug.utils import secure_filename
from flask_cors import CORS
import os
import tempfile
import subprocess
from io import BytesIO

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

    if 'file' not in request.files:
        resp = jsonify({'error': 'No file uploaded'})
        resp.headers['Access-Control-Allow-Origin'] = '*'
        return resp, 400
    file = request.files['file']
    if file.filename == '':
        resp = jsonify({'error': 'No selected file'})
        resp.headers['Access-Control-Allow-Origin'] = '*'
        return resp, 400
    if not file.filename.lower().endswith('.mp4'):
        resp = jsonify({'error': 'Only MP4 files are allowed'})
        resp.headers['Access-Control-Allow-Origin'] = '*'
        return resp, 400

    filename = secure_filename(file.filename)
    with tempfile.TemporaryDirectory() as tmpdir:
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
            print("FFmpeg command:", 'ffmpeg -y -loglevel error -i', mp4_path, '-vn -acodec libmp3lame -ab 192k', mp3_path)
            print("MP4 path:", mp4_path, "Exists:", os.path.exists(mp4_path))
            print("MP3 path (should be created):", mp3_path, "Exists:", os.path.exists(mp3_path))
            print("FFmpeg return code:", result.returncode)
            print("FFmpeg stderr:", result.stderr.decode())
            print("FFmpeg stdout:", result.stdout.decode())
            if result.returncode != 0 or not os.path.exists(mp3_path):
                resp = jsonify({'error': 'Conversion failed: ' + result.stderr.decode()})
                resp.headers['Access-Control-Allow-Origin'] = '*'
                return resp, 500
        except Exception as e:
            print("Exception during conversion:", str(e))
            resp = jsonify({'error': f'Conversion failed: {str(e)}'})
            resp.headers['Access-Control-Allow-Origin'] = '*'
            return resp, 500

        # FIX: Read the file into memory before sending, to avoid Windows file lock issues
        with open(mp3_path, 'rb') as f:
            mp3_data = f.read()

        @after_this_request
        def cleanup(response):
            try:
                if os.path.exists(mp3_path):
                    os.remove(mp3_path)
            except Exception as cleanup_err:
                print("Cleanup error:", cleanup_err)
            return response

        response = send_file(
            BytesIO(mp3_data),
            as_attachment=True,
            download_name=os.path.basename(mp3_path),
            mimetype='audio/mpeg'
        )
        response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['Access-Control-Allow-Credentials'] = 'true'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
        response.headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
        return response

@app.route('/')
def index():
    return 'MP4 to MP3 backend is running.'

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000,debug=True)
