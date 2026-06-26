require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const port = process.env.PORT || 3000;

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("CRITICAL ERROR: SUPABASE_URL or SUPABASE_KEY is missing from environment variables!");
  console.error("Please add them in the Railway Dashboard under the Variables tab.");
}

const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

app.use(cors());
app.use(express.json());

const authenticateApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== process.env.API_SECRET) {
    return res.status(401).json({ error: 'Unauthorized: Invalid API Key' });
  }
  next();
};

app.use('/memory', authenticateApiKey);

app.post('/memory', async (req, res) => {
  const { topic, content, saved_by, tags } = req.body;
  
  if (!topic || !content) {
    return res.status(400).json({ error: 'Topic and content are required' });
  }

  const { data, error } = await supabase
    .from('memories')
    .insert([{ topic, content, saved_by, tags }])
    .select();

  if (error) {
    return res.status(500).json({ error: error.message });
  }
  
  res.status(201).json(data[0]);
});

app.get('/memory/search', async (req, res) => {
  const { q } = req.query;
  
  if (!q) {
    return res.status(400).json({ error: 'Search query "q" is required' });
  }

  const { data, error } = await supabase
    .from('memories')
    .select('*')
    .or(`topic.ilike.%${q}%,content.ilike.%${q}%`)
    .order('created_at', { ascending: false });

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json(data);
});

app.get('/memory/recent', async (req, res) => {
  const { data, error } = await supabase
    .from('memories')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json(data);
});

app.delete('/memory/:id', async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('memories')
    .delete()
    .eq('id', id)
    .select();

  if (error) {
    return res.status(500).json({ error: error.message });
  }
  
  if (data.length === 0) {
    return res.status(404).json({ error: 'Memory not found' });
  }

  res.json({ message: 'Memory deleted successfully', data: data[0] });
});

app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Team Shared Memory API is running' });
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
