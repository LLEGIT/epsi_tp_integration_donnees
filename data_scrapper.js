const axios = require('axios');
const { Parser } = require('json2csv');
const fs = require('fs');

const API_URL = 'https://opentdb.com/api.php?amount=1&token=29ba745002473285e6883c5df4846526d5ab9cf51213681ed67843fad85d3b0d';

const CSV_FILE = 'trivia_data.csv';

async function fetchTriviaData() {
    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
    await sleep(10000);
    try {
        const response = await axios.get(API_URL);
        const data = response.data;

        if (data.response_code === 0) {
            return data.results;
        } else {
            console.error('Failed to fetch trivia data. Response code:', data.response_code);
            return [];
        }
    } catch (error) {
        console.error('Error fetching data from the API:', error.message);
        return [];
    }
}

async function appendToCsv(data) {
    if (!data || data.length === 0) {
        console.log('No data to write to CSV.');
        return;
    }

    const fields = ['category', 'type', 'difficulty', 'question', 'correct_answer', 'incorrect_answers'];
    const json2csvParser = new Parser({ fields, header: false });
    const csv = json2csvParser.parse(data);

    fs.appendFile(CSV_FILE, `${csv}\n`, (err) => {
        if (err) {
            console.error('Error writing to CSV file:', err.message);
        } else {
            console.log('Data successfully appended to', CSV_FILE);
        }
    });
}

(async function main() {
    console.log('Fetching trivia data...');
    const triviaData = await fetchTriviaData();

    if (triviaData.length > 0) {
        console.log('Appending trivia data to CSV...');
        await appendToCsv(triviaData);

        main();
    } else {
        console.log('No trivia data fetched.');
    }
})();
