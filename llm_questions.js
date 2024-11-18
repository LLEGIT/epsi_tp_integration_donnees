const axios = require('axios');
const fs = require('fs');
const csvParser = require('csv-parser');

const API_URL = 'http://localhost:11434/api/generate';
const MODEL = 'llama3.2';

const CSV_FILE = 'trivia_data.csv';

const MAX_ROWS = 50;

let correctCount = 0;
let incorrectCount = 0;

async function askQuestionWithContext(question, possibleAnswers, boolean = false, askedAlready = false, index = 0) {
    let prompt;

    if (possibleAnswers) {
        prompt = `
You are given the following multiple type question: ${question}\n
The possible answers are:\n
${possibleAnswers.map((answer, index) => `- ${answer}`).join('\n')}
I want you to provide an answer to this question from the possible answers I gave you, with this structure {"answer": answer}.\n
You are forbidden to answer something different from the possible answers I provided.`;
    } else {
        prompt = `
You are given the following boolean type question: ${question}\n
I want you to answer either by True or False, with this structure {"answer": "True" | "False"}.
You are forbidden to answer something different than "True" or "False".`;
    }

    if (askedAlready) {
        prompt += '\nYou did not answer correctly, either the structure is not correct or the answer is not one among the ones I provided. Please try again';
    }

    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
    await sleep(1000);

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

        if (!response?.data) {
            return '';
        }

        const formattedResponse = formatLlmAnswer(response.data.response);

        if (!possibleAnswers.includes(formattedResponse) && index < 5) {
            askQuestionWithContext(question, possibleAnswers, boolean, true, index++);
        }

        return formattedResponse;
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

            let rowsProcessed = 1;

            for (const row of rows) {
                if (rowsProcessed > MAX_ROWS) {
                    console.log('\n--- Evaluation Complete ---');
                    console.log(`Total Questions: ${MAX_ROWS}`);
                    console.log(`Correct percentage: ${getCorrectPercentage(correctCount)}%`);
                    process.exit();
                }

                const { type, question, correct_answer, incorrect_answers } = row;

                const incorrectAnswers = incorrect_answers ? JSON.parse(incorrect_answers) : [];
                const possibleAnswers = [correct_answer, ...incorrectAnswers];

                console.log(`\nQuestion ${rowsProcessed}: ${question}`);

                let apiAnswer;
                if (type === 'boolean') {
                    apiAnswer = await askQuestionWithContext(question, possibleAnswers, true);
                } else if (type === 'multiple') {
                    apiAnswer = await askQuestionWithContext(question, possibleAnswers);
                } else {
                    console.error(`Unknown question type: ${type}`);
                    continue;
                }

                if (!apiAnswer) {
                    console.log('❓ No answer received from LLM.');
                    continue;
                }
                
                if (apiAnswer === correct_answer) {
                    console.log('✅ Correct!');
                    correctCount++;
                } else {
                    console.log('❌ Incorrect.' + ' | Expected: ' + correct_answer + ' | Received: ' + apiAnswer);
                    incorrectCount++;
                }

                rowsProcessed++;
            }
        })
        .on('error', (error) => {
            console.error('Error processing the CSV:', error.message);
        });
}

function formatLlmAnswer(apiAnswer) {
    try {
        const parsed = JSON.parse(apiAnswer);
        if (typeof parsed === 'object') {
            if (!parsed.answer) {
                return '';
            }

            if (typeof parsed.answer === 'number') {
                return parsed.answer.toString();
            }

            if (typeof parsed.answer === 'boolean') {
                return parsed.answer.toString();
            }

            return parsed.answer;
        }

        return '';
    } catch (error) {
        console.error(error);
    }

    return apiAnswer.trim().toLowerCase();
}

function getCorrectPercentage(correctCount) {
    return ((correctCount/MAX_ROWS) * 100).toFixed(2);
}

(async function main() {
    try {
        await processCsv();
    } catch (error) {
        console.error('Error during execution:', error.message);
    }
})();
