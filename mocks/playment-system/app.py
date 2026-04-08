from flask import Flask, request, jsonify
import uuid
import logging

app = Flask(__name__)
logging.basicConfig(level=logging.INFO)

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok'}), 200

@app.route('/api/payments/process', methods=['POST'])
def process_payment():
    data = request.json
    logging.info(f"Processing payment: {data}")
    
    return jsonify({
        'payment_id': str(uuid.uuid4()),
        'status': 'SUCCESS',
        'amount': data.get('amount', 0),
        'transaction_id': str(uuid.uuid4()),
        'message': 'Payment processed successfully'
    }), 200

@app.route('/api/balances/request', methods=['POST'])
def get_balance():
    data = request.json
    logging.info(f"Balance request for user: {data.get('user_id')}")
    
    return jsonify({
        'user_id': data.get('user_id'),
        'balance': 10000.00,
        'currency': 'RUB',
        'available': 8500.00
    }), 200

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8090, debug=True)