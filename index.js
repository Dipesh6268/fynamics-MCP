require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { SSEServerTransport } = require("@modelcontextprotocol/sdk/server/sse.js");
const { CallToolRequestSchema, ListToolsRequestSchema } = require("@modelcontextprotocol/sdk/types.js");

const app = express();
const port = process.env.PORT || 3000;

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("CRITICAL ERROR: SUPABASE_URL or SUPABASE_KEY is missing from environment variables!");
  console.error("Please add them in the Railway Dashboard under the Variables tab.");
}

const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

function createMcpServer() {
  const server = new Server(
    { name: "Team Memory MCP Server", version: "1.0.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: "save_memory",
          description: "Save a new memory or piece of knowledge for the team. Feel free to use this tool automatically to save important facts, project details, or context mentioned by the user.",
          inputSchema: {
            type: "object",
            properties: {
              topic: { type: "string" },
              content: { type: "string" },
              saved_by: { type: "string" },
              tags: { type: "array", items: { type: "string" } }
            },
            required: ["topic", "content"]
          }
        },
        {
          name: "search_memories",
          description: "Search team memories by a specific keyword. Use this tool automatically when the user asks a question about past context, projects, or decisions.",
          inputSchema: {
            type: "object",
            properties: { q: { type: "string" } },
            required: ["q"]
          }
        },
        {
          name: "get_recent_memories",
          description: "Get the 20 most recently saved team memories.",
          inputSchema: { type: "object", properties: {} }
        },
        {
          name: "delete_memory",
          description: "Delete a specific memory by its ID.",
          inputSchema: {
            type: "object",
            properties: { id: { type: "string" } },
            required: ["id"]
          }
        }
      ]
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
      if (name === "save_memory") {
        const { topic, content, saved_by, tags } = args;
        const { data, error } = await supabase.from('memories').insert([{ topic, content, saved_by, tags }]).select();
        if (error) throw error;
        return { content: [{ type: "text", text: `Memory saved successfully! ID: ${data[0].id}` }] };
      }
      if (name === "search_memories") {
        const { q } = args;
        const { data, error } = await supabase.from('memories').select('*').or(`topic.ilike.%${q}%,content.ilike.%${q}%`).order('created_at', { ascending: false });
        if (error) throw error;
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }
      if (name === "get_recent_memories") {
        const { data, error } = await supabase.from('memories').select('*').order('created_at', { ascending: false }).limit(20);
        if (error) throw error;
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }
      if (name === "delete_memory") {
        const { id } = args;
        const { data, error } = await supabase.from('memories').delete().eq('id', id).select();
        if (error) throw error;
        if (data.length === 0) return { content: [{ type: "text", text: "Memory not found." }] };
        return { content: [{ type: "text", text: `Memory deleted successfully: ${data[0].topic}` }] };
      }
      throw new Error(`Unknown tool: ${name}`);
    } catch (error) {
      return { content: [{ type: "text", text: `Error executing tool: ${error.message}` }], isError: true };
    }
  });

  return server;
}

const mcpTransports = new Map();

app.get('/sse', async (req, res) => {
  const transport = new SSEServerTransport("/messages", res);
  const server = createMcpServer();
  await server.connect(transport);
  mcpTransports.set(transport.sessionId, transport);
  
  res.on('close', () => {
    mcpTransports.delete(transport.sessionId);
  });
});

app.post('/messages', async (req, res) => {
  const sessionId = req.query.sessionId;
  const transport = mcpTransports.get(sessionId);
  if (!transport) {
    return res.status(404).send("Session not found");
  }
  await transport.handlePostMessage(req, res);
});

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
  res.json({ status: 'ok', message: 'Team Shared Memory API is running (v3)' });
});

// MCP server implementation moved up into a function

// MCP Routes moved to top of file

app.listen(port, () => {
  console.log(`Server is running on port ${port} (REST + SSE MCP)`);
});
