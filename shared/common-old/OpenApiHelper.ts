import { ApiHeaderOptions, ApiResponseOptions } from '@nestjs/swagger';

export default class OpenApiHelper {
  public static userIdHeader: ApiHeaderOptions = {
    name: 'user_id',
    description: "Requesting user's ID",
    required: true,
    example: '1',
  };

  public static responseDoc: ApiResponseOptions = {
    status: 200,
    description: 'Successful response',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number' },
        message: { type: 'string' },
        data: { type: 'object' },
      },
    },
  };

  public static paginatedResponseDoc: ApiResponseOptions = {
    status: 200,
    description: 'Successful response',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number' },
        message: { type: 'string' },
        data: {
          type: 'object',
          properties: {
            data: { type: 'array', items: { type: 'object' } }, // Adjust the type based on your actual item type
            meta: {
              type: 'object',
              properties: {
                itemsPerPage: { type: 'number' },
                totalItems: { type: 'number' },
                currentPage: { type: 'number' },
                totalPages: { type: 'number' },
                sortBy: { type: 'array' },
                search: { type: 'string' },
                filter: {
                  type: 'object',
                },
              },
            },
            link: {
              type: 'object',
              properties: {
                first: { type: 'string' },
                previous: { type: 'string' },
                current: { type: 'string' },
                next: { type: 'string' },
                last: { type: 'string' },
              },
            },
          },
        },
      },
    },
  };

  public static arrayResponseDoc: ApiResponseOptions = {
    status: 200,
    description: 'Successful response',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number' },
        message: { type: 'string' },
        data: {
          type: 'array',
          items: { type: 'object' },
        },
      },
    },
  };

  public static nullResponseDoc: ApiResponseOptions = {
    status: 200,
    description: 'Successful response',
    schema: {
      oneOf: [
        {
          type: 'object',
          properties: {
            statusCode: { type: 'number' },
            message: { type: 'string' },
            data: {
              type: 'string',
              nullable: true,
              description: 'Nothing is returned',
            },
          },
        },
      ],
    },
  };

  public static errorResponseDoc: ApiResponseOptions = {
    status: 200,
    description: 'Successful response',
    schema: {
      oneOf: [
        {
          type: 'object',
          properties: {
            statusCode: { type: 'number' },
            message: { type: 'string' },
            error: {
              type: 'object',
            },
          },
        },
      ],
    },
  };
}
