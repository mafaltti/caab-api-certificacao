const swaggerSpec = {
  openapi: "3.0.0",
  info: {
    title: "CAAB API Certificação",
    version: "1.0.0",
    description:
      'REST API (CRUD) for "Primeira Certificação" Google Spreadsheet',
  },
  security: [{ basicAuth: [] }],
  components: {
    securitySchemes: {
      basicAuth: {
        type: "http",
        scheme: "basic",
      },
    },
    schemas: {
      Ticket: {
        type: "object",
        properties: {
          ticket: { type: "string", example: "12345678900" },
        },
      },
      Pedido: {
        type: "object",
        properties: {
          uuid: {
            type: "string",
            format: "uuid",
            example: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
          },
          ticket: { type: "string", example: "68637750800" },
          numero_oab: { type: "string", example: "123456" },
          nome_completo: { type: "string", example: "João da Silva" },
          subsecao: { type: "string", example: "São Paulo" },
          data_solicitacao: { type: "string", example: "2026-02-13" },
          data_liberacao: { type: "string", example: "2026-02-20" },
          status: { type: "string", example: "aprovado" },
          anotacoes: { type: "string", example: "Primeira certificação" },
        },
      },
      CreatePedido: {
        type: "object",
        required: ["ticket", "nome_completo"],
        properties: {
          ticket: { type: "string", example: "68637750800" },
          nome_completo: { type: "string", example: "João da Silva" },
          numero_oab: { type: "string", example: "123456" },
          subsecao: { type: "string", example: "São Paulo" },
          data_solicitacao: {
            type: "string",
            pattern: "^\\d{4}-\\d{2}-\\d{2}$",
            example: "2026-02-13",
          },
          data_liberacao: {
            type: "string",
            pattern: "^\\d{4}-\\d{2}-\\d{2}$",
            example: "2026-02-20",
          },
          status: { type: "string", example: "pendente" },
          anotacoes: { type: "string", example: "Primeira certificação" },
        },
      },
      SuccessResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: true },
          data: { type: "object" },
        },
      },
      ListResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: true },
          count: { type: "integer", example: 5 },
          data: { type: "array", items: {} },
        },
      },
      ErrorResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: false },
          error: { type: "string", example: "Error message" },
        },
      },
    },
  },
  paths: {
    "/api/tickets": {
      get: {
        summary: "List all tickets",
        tags: ["Tickets"],
        responses: {
          200: {
            description: "List of tickets",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/ListResponse" },
                    {
                      properties: {
                        data: {
                          items: { $ref: "#/components/schemas/Ticket" },
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
        },
      },
      post: {
        summary: "Add a new ticket",
        tags: ["Tickets"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Ticket" },
            },
          },
        },
        responses: {
          201: {
            description: "Ticket created",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      properties: {
                        data: { $ref: "#/components/schemas/Ticket" },
                      },
                    },
                  ],
                },
              },
            },
          },
          400: {
            description: "Validation error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          409: {
            description: "Ticket already exists",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/tickets/{ticket}": {
      get: {
        summary: "Check if a specific ticket exists",
        tags: ["Tickets"],
        parameters: [
          {
            in: "path",
            name: "ticket",
            required: true,
            schema: { type: "string" },
            description: "Ticket number",
          },
        ],
        responses: {
          200: {
            description: "Ticket found",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      properties: {
                        data: { $ref: "#/components/schemas/Ticket" },
                      },
                    },
                  ],
                },
              },
            },
          },
          404: {
            description: "Ticket not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
      put: {
        summary: "Update a ticket value",
        tags: ["Tickets"],
        parameters: [
          {
            in: "path",
            name: "ticket",
            required: true,
            schema: { type: "string" },
            description: "Current ticket number",
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Ticket" },
            },
          },
        },
        responses: {
          200: {
            description: "Ticket updated",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      properties: {
                        data: { $ref: "#/components/schemas/Ticket" },
                      },
                    },
                  ],
                },
              },
            },
          },
          404: {
            description: "Ticket not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
      delete: {
        summary: "Remove a ticket",
        tags: ["Tickets"],
        parameters: [
          {
            in: "path",
            name: "ticket",
            required: true,
            schema: { type: "string" },
            description: "Ticket number to delete",
          },
        ],
        responses: {
          200: {
            description: "Ticket deleted",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SuccessResponse" },
              },
            },
          },
          404: {
            description: "Ticket not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/pedidos": {
      get: {
        summary: "List all pedidos",
        tags: ["Pedidos"],
        parameters: [
          {
            in: "query",
            name: "status",
            schema: { type: "string" },
            description: "Filter by status",
          },
          {
            in: "query",
            name: "ticket",
            schema: { type: "string" },
            description: "Filter by ticket",
          },
          {
            in: "query",
            name: "oab",
            schema: { type: "string" },
            description: "Filter by OAB number",
          },
        ],
        responses: {
          200: {
            description: "List of pedidos",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/ListResponse" },
                    {
                      properties: {
                        data: {
                          items: { $ref: "#/components/schemas/Pedido" },
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
        },
      },
      post: {
        summary: "Create a new pedido",
        tags: ["Pedidos"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreatePedido" },
            },
          },
        },
        responses: {
          201: {
            description: "Pedido created (UUID generated by API)",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      properties: {
                        data: { $ref: "#/components/schemas/Pedido" },
                      },
                    },
                  ],
                },
              },
            },
          },
          400: {
            description: "Validation error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/pedidos/{uuid}": {
      get: {
        summary: "Get pedido by UUID",
        tags: ["Pedidos"],
        parameters: [
          {
            in: "path",
            name: "uuid",
            required: true,
            schema: { type: "string", format: "uuid" },
            description: "Pedido UUID",
          },
        ],
        responses: {
          200: {
            description: "Pedido found",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      properties: {
                        data: { $ref: "#/components/schemas/Pedido" },
                      },
                    },
                  ],
                },
              },
            },
          },
          404: {
            description: "Pedido not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
      put: {
        summary: "Update a pedido (partial)",
        tags: ["Pedidos"],
        parameters: [
          {
            in: "path",
            name: "uuid",
            required: true,
            schema: { type: "string", format: "uuid" },
            description: "Pedido UUID",
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreatePedido" },
            },
          },
        },
        responses: {
          200: {
            description: "Pedido updated",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/SuccessResponse" },
                    {
                      properties: {
                        data: { $ref: "#/components/schemas/Pedido" },
                      },
                    },
                  ],
                },
              },
            },
          },
          404: {
            description: "Pedido not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
      delete: {
        summary: "Remove a pedido",
        tags: ["Pedidos"],
        parameters: [
          {
            in: "path",
            name: "uuid",
            required: true,
            schema: { type: "string", format: "uuid" },
            description: "Pedido UUID",
          },
        ],
        responses: {
          200: {
            description: "Pedido deleted",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SuccessResponse" },
              },
            },
          },
          404: {
            description: "Pedido not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
  },
};

export default swaggerSpec;
