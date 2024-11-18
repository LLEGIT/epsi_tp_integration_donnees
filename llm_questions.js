const axios = require('axios');
const fs = require('fs');
const csvParser = require('csv-parser');

const API_URL = 'http://localhost:11434/api/generate';
const MODEL = 'llama3.2';

const CSV_FILE = 'trivia_data.csv';

let correctCount = 0;
let incorrectCount = 0;

async function askQuestionWithContext(question, possibleAnswers) {
    const prompt = `
You are answering a trivia question. The question is:

"${question}"

The possible answers are:
${possibleAnswers.map((answer, index) => `${index + 1}. ${answer}`).join('\n')}

Respond only with the answer text, not the number.`;

    try {
        const response = await axios.post(API_URL, {
            model: MODEL,
            prompt: prompt,
            format: 'json',
            stream: false
        }, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        return response.data?.answer?.trim() || '';
    } catch (error) {
        console.error('Error while communicating with the API:', error.message);
        return null;
    }
}

async function processCsv() {
    const rows = [];

    fs.createReadStream(CSV_FILE)
        .pipe(csvParser())
        .on('data', (row) => rows.push(row))
        .on('end', async () => {
            console.log('Starting evaluation...');

            for (const row of rows) {
                const { type, question, correct_answer, incorrect_answers } = row;

                // Parse incorrect answers if they are stored as a JSON array string
                const incorrectAnswers = incorrect_answers ? JSON.parse(incorrect_answers) : [];
                const possibleAnswers = [correct_answer, ...incorrectAnswers];

                console.log(`\nQuestion: ${question}`);

                let apiAnswer;
                if (type === 'boolean') {
                    // For boolean questions, let the LLM answer True or False
                    apiAnswer = await askQuestionWithContext(question, ['True', 'False']);
                } else if (type === 'multiple') {
                    // For multiple-choice questions, pass all possible answers
                    apiAnswer = await askQuestionWithContext(question, possibleAnswers);
                } else {
                    console.error(`Unknown question type: ${type}`);
                    continue;
                }

                if (!apiAnswer) {
                    console.log('❓ No answer received from LLM.');
                    continue;
                }

                console.log(`LLM Answer: ${apiAnswer}`);
                console.log(`Correct Answer: ${correct_answer}`);

                if (apiAnswer.trim().toLowerCase() === correct_answer.trim().toLowerCase()) {
                    console.log('✅ Correct!');
                    correctCount++;
                } else {
                    console.log('❌ Incorrect.');
                    incorrectCount++;
                }
            }

            console.log('\n--- Evaluation Complete ---');
            console.log(`Total Questions: ${rows.length}`);
            console.log(`Total Correct: ${correctCount}`);
            console.log(`Total Incorrect: ${incorrectCount}`);
        })
        .on('error', (error) => {
            console.error('Error processing the CSV:', error.message);
        });
}

(async function main() {
    try {
        await processCsv();
    } catch (error) {
        console.error('Error during execution:', error.message);
    }
})();
