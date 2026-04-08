from flask import Flask, request, jsonify
import logging
import random

app = Flask(__name__)
logging.basicConfig(level=logging.INFO)

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok'}), 200

@app.route('/api/check-transaction', methods=['POST'])
def check_transaction():
    data = request.json
    logging.info(f"Checking transaction: {data}")
    
    # 95% транзакций проходят проверку
    is_fraud = random.random() < 0.05
    
    return jsonify({
        'transaction_id': data.get('transaction_id'),
        'is_fraud': is_fraud,
        'risk_score': random.randint(0, 100),
        'status': 'REJECTED' if is_fraud else 'APPROVED',
        'message': 'Fraud check completed'
    }), 200

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8091, debug=True)