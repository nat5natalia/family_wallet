from flask import Flask, request, jsonify
import uuid
import logging

app = Flask(__name__)
logging.basicConfig(level=logging.INFO)

# Хранилище квестов и прогресса
quests = {}
user_progress = {}

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok'}), 200

@app.route('/api/quests/create', methods=['POST'])
def create_quest():
    data = request.json
    quest_id = str(uuid.uuid4())
    quests[quest_id] = {
        'id': quest_id,
        'title': data.get('title', 'New Quest'),
        'reward': data.get('reward', 100),
        'xp': data.get('xp', 50),
        'status': 'ACTIVE'
    }
    logging.info(f"Created quest: {quest_id}")
    return jsonify(quests[quest_id]), 201

@app.route('/api/quests/complete', methods=['POST'])
def complete_quest():
    data = request.json
    quest_id = data.get('quest_id')
    user_id = data.get('user_id')
    
    if quest_id in quests:
        quests[quest_id]['status'] = 'COMPLETED'
        
        # Обновляем прогресс пользователя
        if user_id not in user_progress:
            user_progress[user_id] = {'points': 0, 'level': 1}
        
        user_progress[user_id]['points'] += quests[quest_id]['xp']
        user_progress[user_id]['level'] = 1 + (user_progress[user_id]['points'] // 500)
        
        return jsonify({
            'status': 'COMPLETED',
            'reward': quests[quest_id]['reward'],
            'xp_gained': quests[quest_id]['xp'],
            'user_level': user_progress[user_id]['level']
        }), 200
    
    return jsonify({'error': 'Quest not found'}), 404

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8092, debug=True)