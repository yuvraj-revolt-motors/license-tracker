from flask import Flask, render_template
from flask_cors import CORS
from controllers.auth_controller import auth_bp
from controllers.license_controller import license_bp
from controllers.ticket_controller import ticket_bp

app = Flask(__name__, static_folder='../frontend', static_url_path='', template_folder='../frontend')
CORS(app) # Enable CORS for all routes (important during development)

# Register Blueprints
app.register_blueprint(auth_bp)
app.register_blueprint(license_bp)
app.register_blueprint(ticket_bp)

# --- Frontend Serving Route ---
@app.route('/')
def serve_frontend():
    """Serves the main frontend HTML file."""
    return render_template('index.html')

if __name__ == '__main__':
    app.run(debug=True, port=7878)