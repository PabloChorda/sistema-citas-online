# backend/run.py
from flask import Flask, jsonify

app = Flask(__name__)

@app.route('/')
def home():
    return "Hola desde el Backend de Flask!"

@app.route('/api/test')
def api_test():
    return jsonify({"message": "API funcionando correctamente!"})

if __name__ == '__main__':
    app.run(debug=True, port=5001) # Usamos un puerto diferente al del frontend