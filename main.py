from flask import Flask, request, jsonify 
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

#Example of calculating SF and BM and determining reinforcement bars
@app.route('/calculate')
def calculate():
    data = request.json
    beam_type = data['beamType']
    sf = data['shearForce']
    bm = data['bendingmoment']

    #Example logic for reinforcement 
    min_bars = 2
    max_bar_per_row = 4
    num_bars = max(min_bars, int(bm // 10))
    rows = (num_bars + max_bar_per_row - 1) // max_bar_per_row
    response = {
        "numBars": num_bars,
        "rows": rows,
        "beamType":beam_type
    }
    return jsonify(response)
if __name__ == '__main__':
    app.run(debug=True)
