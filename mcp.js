#!/usr/bin/env node
require('dotenv').config();
const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const { CallToolRequestSchema, ListToolsRequestSchema } = require("@modelcontextprotocol/sdk/types.js");
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("CRITICAL ERROR: SUPABASE_URL or SUPABASE_KEY is missing from environment variables!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const server = new Server(
  {
    name: "Team Memory MCP Server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "save_memory",
        description: "Save a new memory or piece of knowledge for the team.",
        inputSchema: {
          type: "object",
          properties: {
            topic: { type: "string", description: "The topic or subject of the memory" },
            content: { type: "string", description: "The actual knowledge or information to remember" },
            saved_by: { type: "string", description: "Your name or the name of the team member saving this memory" },
            tags: { type: "array", items: { type: "string" }, description: "Categories or tags for the memory" }
          },
          required: ["topic", "content"]
        }
      },
      {
        name: "search_memories",
        description: "Search team memories by a specific keyword.",
        inputSchema: {
          type: "object",
          properties: {
            q: { type: "string", description: "Keyword to search across all memories" }
          },
          required: ["q"]
        }
      },
      {
        name: "get_recent_memories",
        description: "Get the 20 most recently saved team memories.",
        inputSchema: {
          type: "object",
          properties: {}
        }
      },
      {
        name: "delete_memory",
        description: "Delete a specific memory by its ID.",
        inputSchema: {
          type: "object",
          properties: {
            id: { type: "string", description: "The UUID of the memory to delete" }
          },
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
      const { data, error } = await supabase
        .from('memories')
        .insert([{ topic, content, saved_by, tags }])
        .select();

      if (error) throw error;
      
      return {
        content: [{ type: "text", text: `Memory saved successfully! ID: ${data[0].id}` }]
      };
    }

    if (name === "search_memories") {
      const { q } = args;
      const { data, error } = await supabase
        .from('memories')
        .select('*')
        .or(`topic.ilike.%${q}%,content.ilike.%${q}%`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
      };
    }

    if (name === "get_recent_memories") {
      const { data, error } = await supabase
        .from('memories')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
      };
    }

    if (name === "delete_memory") {
      const { id } = args;
      const { data, error } = await supabase
        .from('memories')
        .delete()
        .eq('id', id)
        .select();

      if (error) throw error;
      if (data.length === 0) return { content: [{ type: "text", text: "Memory not found." }] };
      
      return {
        content: [{ type: "text", text: `Memory deleted successfully: ${data[0].topic}` }]
      };
    }

    throw new Error(`Unknown tool: ${name}`);
  } catch (error) {
    return {
      content: [{ type: "text", text: `Error executing tool: ${error.message}` }],
      isError: true
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Log strictly to stderr so it doesn't corrupt the stdio MCP stream
  console.error("Team Memory MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
