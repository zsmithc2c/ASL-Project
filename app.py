from flask import Flask, render_template, request, jsonify, session, send_from_directory
from flask_session import Session
import openai
import os

app = Flask(__name__)
app.config["SESSION_PERMANENT"] = False
app.config["SESSION_TYPE"] = "filesystem"
Session(app)

openai.api_key = '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'
app.secret_key = 'supersecretkey'

topic_info = ""
try:
    with open('topic_prompts/sign_descriptions.txt', 'r') as file:
        topic_info = file.read()
except Exception as e:
    print(f"Failed to read topic descriptions: {e}")


@app.route('/')
def home():
    return render_template('index.html')


@app.route('/static/images/<path:filename>')
def serve_image(filename):
    return send_from_directory('static/images', filename)


@app.route('/models/<path:filename>')
def serve_model(filename):
    return send_from_directory('models', filename)


@app.route('/chat', methods=['POST'])
def chat():
    user_message = request.json['message']
    current_letter = request.json['currentLetter']

    if 'conversation' not in session:
        session['conversation'] = []
        system_message = "We are using a gesture recognition system to learn American Sign Language alphabet. Guide the user through the alphabet, starting with A. Be encouraging and provide tips for forming each letter. Keep responses short and under 50 words."
    else:
        system_message = f"The user has correctly signed the letter {current_letter}. Praise them and introduce the next letter, explaining how to form it in ASL."

    session['conversation'].append({"role": "user", "content": user_message})
    messages = [{
        "role": "system",
        "content": system_message + topic_info
    }] + session['conversation']

    try:
        response = openai.chat.completions.create(model="gpt-4o",
                                                  messages=messages)
        gpt_response = response.choices[0].message.content
        session['conversation'].append({
            "role": "assistant",
            "content": gpt_response
        })
        return jsonify({'response': gpt_response})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    app.run(host="0.0.0.0", port=8080)
