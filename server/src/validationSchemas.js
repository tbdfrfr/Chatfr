const userNumber = {
  anyOf: [
    { type: 'integer', minimum: 1 },
    { type: 'string', pattern: '^[1-9][0-9]{0,15}$' }
  ]
};

const threadId = {
  type: 'string',
  minLength: 1,
  maxLength: 120,
  pattern: '^[A-Za-z0-9_:-]+$'
};

const groupNameColor = {
  type: 'string',
  maxLength: 20
};

const groupNameFont = {
  type: 'string',
  maxLength: 40
};

const displayName = {
  type: 'string',
  maxLength: 80
};

const profileCell = {
  anyOf: [
    { type: 'null' },
    { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
    { type: 'string', maxLength: 0 }
  ]
};

const profilePicture = {
  anyOf: [
    {
      type: 'array',
      minItems: 49,
      maxItems: 49,
      items: profileCell
    },
    {
      type: 'string',
      maxLength: 1_000_000,
      pattern: '^data:image/[a-zA-Z0-9.+-]+;base64,[a-zA-Z0-9+/=]+$'
    }
  ]
};

const jsonObject = (schema) => ({
  type: 'object',
  additionalProperties: false,
  ...schema
});

export const authRouteSchemas = {
  signup: {
    body: jsonObject({
      required: ['password'],
      properties: {
        displayName,
        password: { type: 'string', minLength: 8, maxLength: 256 }
      }
    })
  },
  login: {
    body: jsonObject({
      required: ['userNumber', 'password'],
      properties: {
        userNumber,
        password: { type: 'string', minLength: 1, maxLength: 256 }
      }
    })
  }
};

export const userRouteSchemas = {
  displayName: {
    body: jsonObject({
      required: ['displayName'],
      properties: {
        displayName
      }
    })
  },
  profilePicture: {
    body: jsonObject({
      required: ['profilePicture'],
      properties: {
        profilePicture
      }
    })
  },
  userNumber: {
    params: jsonObject({
      required: ['userNumber'],
      properties: {
        userNumber
      }
    })
  }
};

export const threadRouteSchemas = {
  dmStart: {
    body: jsonObject({
      required: ['userNumber'],
      properties: {
        userNumber
      }
    })
  },
  createGroup: {
    body: jsonObject({
      properties: {
        name: displayName,
        nameColor: groupNameColor,
        nameFont: groupNameFont,
        memberNumbers: {
          type: 'array',
          maxItems: 100,
          items: userNumber
        }
      }
    })
  },
  updateGroup: {
    params: jsonObject({
      required: ['threadId'],
      properties: {
        threadId
      }
    }),
    body: jsonObject({
      properties: {
        name: displayName,
        nameColor: groupNameColor,
        nameFont: groupNameFont,
        memberNumbers: {
          type: 'array',
          maxItems: 100,
          items: userNumber
        }
      }
    })
  },
  threadId: {
    params: jsonObject({
      required: ['threadId'],
      properties: {
        threadId
      }
    })
  },
  messages: {
    params: jsonObject({
      required: ['threadId'],
      properties: {
        threadId
      }
    }),
    querystring: jsonObject({
      properties: {
        before: userNumber,
        limit: {
          anyOf: [
            { type: 'integer', minimum: 1, maximum: 100 },
            { type: 'string', pattern: '^[1-9][0-9]?$|^100$' }
          ]
        }
      }
    })
  },
  createMessage: {
    params: jsonObject({
      required: ['threadId'],
      properties: {
        threadId
      }
    }),
    body: jsonObject({
      required: ['content'],
      properties: {
        content: { type: 'string', minLength: 1, maxLength: 2000 }
      }
    })
  }
};
