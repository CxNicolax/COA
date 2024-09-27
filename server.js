const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.send('Server is running. Use the endpoints /api/files and /api/data for data access.');
});

app.get('/api/simboli', async (req, res) => {
    try {
        const directoryPath = path.join(__dirname, 'Simboli');
        const files = await fs.readdir(directoryPath);
        const txtFiles = files.filter(file => path.extname(file).toLowerCase() === '.txt');
        res.json(txtFiles);
    } catch (error) {
        console.error('Error reading Simboli directory:', error);
        res.status(500).json({ error: 'An error occurred while reading the Simboli directory' });
    }
});

app.get('/api/files', async (req, res) => {
    try {
        const directoryPath = path.join(__dirname, 'file');
        const files = await fs.readdir(directoryPath);
        const txtFiles = files.filter(file => path.extname(file).toLowerCase() === '.txt');
        res.json(txtFiles);
    } catch (error) {
        console.error('Error reading directory:', error);
        res.status(500).json({ error: 'An error occurred while reading the directory' });
    }
});

async function getFileData(selectedFiles) {
    const directoryPath = path.join(__dirname, 'file');
    const fileContents = await Promise.all(selectedFiles.map(async file => {
        const filePath = path.join(directoryPath, file);
        const content = await fs.readFile(filePath, 'utf-8');
        return { file, data: parseFileContent(content) };
    }));
    return fileContents;
}

app.get('/api/data', async (req, res) => {
    try {
        const startDate = req.query.startDate;
        const endDate = req.query.endDate; // Ottieni la data di fine dalla query
        const directoryPath = path.join(__dirname, 'file');
        const files = await fs.readdir(directoryPath);
        const txtFiles = files.filter(file => path.extname(file).toLowerCase() === '.txt');
        
        const fileContents = await Promise.all(txtFiles.map(async file => {
            const filePath = path.join(directoryPath, file);
            const content = await fs.readFile(filePath, 'utf-8');
            const data = parseFileContent(content, startDate, endDate); // Passa la data di fine
            return { file, data };
        }));

        res.json(fileContents);
    } catch (error) {
        console.error('Error reading files:', error);
        res.status(500).json({ error: 'An error occurred while reading the files' });
    }
});

function parseFileContent(content, startDate, endDate) {
    return content.split('\n')
        .map(line => {
            const [date, value, value2] = line.split(';');
            return { date, value: parseFloat(value), value2: parseFloat(value2) };
        })
        .filter(item => {
            if (!isNaN(item.value) && !isNaN(item.value2)) {
                const [itemDay, itemMonth, itemYear] = item.date.split('/');
                const itemDate = new Date(`${itemYear}-${itemMonth}-${itemDay}`);
                return (!startDate || itemDate >= new Date(startDate)) &&
                    (!endDate || itemDate <= new Date(endDate));
            }
            return false;
        });
}

app.post('/api/data', async (req, res) => {
    try {
        const { selectedFiles } = req.body;
        const fileContents = await getFileData(selectedFiles);
        res.json(fileContents);
    } catch (error) {
        console.error('Error reading files:', error);
        res.status(500).json({ error: 'An error occurred while reading the files' });
    }
});

app.post('/api/correlazione', async (req, res) => {
    try {
        const { file1, file2, period } = req.body;
        const windowSize = period || 180; // Usa 180 come default se non specificato
        const directoryPath = path.join(__dirname, 'Simboli');

        const data1 = await readFileData(path.join(directoryPath, file1));
        const data2 = await readFileData(path.join(directoryPath, file2));

        const correlations = calculateCorrelations(data1, data2, windowSize);

        res.json(correlations);
    } catch (error) {
        console.error('Error calculating correlation:', error);
        res.status(500).json({ error: 'An error occurred while calculating correlation' });
    }
});

async function readFileData(filePath) {
    const content = await fs.readFile(filePath, 'utf-8');
    return content.split('\n')
        .map(line => {
            const [date, value] = line.split(';');
            return { date, value: parseFloat(value) };
        })
        .filter(item => !isNaN(item.value));
}

function calculateCorrelations(data1, data2, windowSize) {
    const correlations = [];

    for (let i = windowSize; i < Math.min(data1.length, data2.length); i++) {
        const correlation = pearsonCorrelation(
            data1.slice(i - windowSize, i).map(d => d.value),
            data2.slice(i - windowSize, i).map(d => d.value)
        );
        correlations.push({
            date: data1[i].date,
            correlation: correlation
        });
    }

    return correlations;
}

function pearsonCorrelation(x, y) {
    const n = x.length;
    let sum_x = 0, sum_y = 0, sum_xy = 0, sum_x2 = 0, sum_y2 = 0;

    for (let i = 0; i < n; i++) {
        sum_x += x[i];
        sum_y += y[i];
        sum_xy += x[i] * y[i];
        sum_x2 += x[i] * x[i];
        sum_y2 += y[i] * y[i];
    }

    const numerator = n * sum_xy - sum_x * sum_y;
    const denominator = Math.sqrt((n * sum_x2 - sum_x * sum_x) * (n * sum_y2 - sum_y * sum_y));

    if (denominator === 0) return 0;
    return numerator / denominator;
}

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});