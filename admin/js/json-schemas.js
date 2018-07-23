const ajv = new Ajv();

const adminValidators = { // eslint-disable-line no-unused-vars
  getValidateAdminListAirportsReq: function () {
    const adminListAirportsRequestSchema = {
      '$schema': 'http://json-schema.org/draft-07/schema#',
      '$id': 'http://10.20.1.155:3000/adminlistairportsrequest.schema.json',
      'title': 'Admin list airports request',
      'type': 'object',
      'properties': {
        'v': {
          'title': 'API version',
          'type': 'string',
        },
        'api_key': {
          'title': 'API key',
          'type': 'string',
        },
      },
      'required': ['v'],
    };
    return ajv.compile(adminListAirportsRequestSchema);
  },

  getValidateAdminListAirportsRes: function () {
    const adminListAirportsResponseSchema = {
      '$schema': 'http://json-schema.org/draft-07/schema#',
      '$id': 'http://10.20.1.155:3000/adminlistairportsresponse.schema.json',
      'title': 'Admin list airports response',
      'type': 'object',
      'properties': {
        'airports': {
          'type': 'array',
          'title': 'Airports list',
          'items': {
            'type': 'object',
            'properties': {
              'id': {
                'title': 'Airport id from database',
                'type': 'string',
              },
              'iata_code': {
                'title': 'Airport IATA code',
                'type': 'string',
              },
              'name': {
                'title': 'Airport name',
                'type': 'string',
              },
            },
            'required': ['id', 'iata_code', 'name'],
          },
        },
      },
      'required': ['airports'],
    };
    return ajv.compile(adminListAirportsResponseSchema);
  },

  getValidateAdminListSubscriptionsReq: function () {
    const adminListSubscriptionsRequestSchema = {
      '$schema': 'http://json-schema.org/draft-07/schema#',
      '$id': 'http://10.20.1.155:3000/adminlistsubscriptionsresponse.schema.json',
      'title': 'Admin list subscriptions response',
      'type': 'object',
      'properties': {
        'v': {
          'title': 'API version',
          'type': 'string',
        },
        'user_id': {
          'title': 'User id',
          'type': 'string',
        },
        'api_key': {
          'title': 'API key',
          'type': 'string',
        },
      },
      'required': ['v', 'user_id', 'api_key'],
    };
    return ajv.compile(adminListSubscriptionsRequestSchema);
  },

  getValidateAdminListSubscriptionsRes: function () {
    const adminListSubscriptionsResponseSchema = {
      '$schema': 'http://json-schema.org/draft-07/schema#',
      '$id': 'http://10.20.1.155:3000/adminlistsubscriptionsresponse.schema.json',
      'title': 'Admin list subscriptions response',
      'type': 'object',
      'properties': {
        'user_subscriptions': {
          'type': 'array',
          'title': 'List of subscriptions',
          'items': {
            'type': 'object',
            'properties': {
              'id': {
                'type': 'string',
                'title': 'Subscription database id',
              },
              'user': {
                'type': 'object',
                'title': 'User data',
                'properties': {
                  'id': {
                    'type': 'string',
                    'title': 'User id',
                  },
                  'email': {
                    'type': 'string',
                    'title': 'User email',
                    'format': 'email',
                  },
                },
                'required': ['id', 'email'],
              },
              'fly_from': {
                'type': 'string',
                'title': 'Departure airport id',
              },
              'fly_to': {
                'type': 'string',
                'title': 'Arrival airport id',
              },
              'date_from': {
                'type': 'string',
                'title': 'Earliest departure time',
                'format': 'date-time',
              },
              'date_to': {
                'type': 'string',
                'title': 'Latest arrival time',
                'format': 'date-time',
              },
            },
            'required': ['id', 'user', 'fly_from', 'fly_to', 'date_from', 'date_to'],
          },
        },
        'guest_subscriptions': {
          'type': 'array',
          'title': 'List of subscriptions, not linked to users',
          'items': {
            'type': 'object',
            'properties': {
              'id': {
                'type': 'string',
                'title': 'Subscription database id',
              },
              'fly_from': {
                'type': 'string',
                'title': 'Departure airport id',
              },
              'fly_to': {
                'type': 'string',
                'title': 'Arrival airport id',
              },
            },
            'required': ['id', 'fly_from', 'fly_to'],
          },
        },
      },
      'required': ['subscriptions'],
    };
    return ajv.compile(adminListSubscriptionsResponseSchema);
  },

  getValidateAdminListUsersReq: function () {
    const adminListUsersRequestSchema = {
      '$schema': 'http://json-schema.org/draft-07/schema#',
      '$id': 'http://10.20.1.155:3000/adminlistusersrequest.schema.json',
      'title': 'Admin list useres request',
      'type': 'object',
      'properties': {
        'v': {
          'type': 'string',
          'title': 'API version',
        },
        'api_key': {
          'type': 'string',
          'title': 'API key',
        },
      },
      'required': ['v', 'api_key'],
    };
    return ajv.compile(adminListUsersRequestSchema);
  },

  getValidateAdminListUsersRes: function () {
    const adminListUsersResponseSchema = {
      '$schema': 'http://json-schema.org/draft-07/schema#',
      '$id': 'http://10.20.1.155:3000/adminlistusersresponse.schema.json',
      'title': 'Admin list useres response',
      'type': 'object',
      'properties': {
        'users': {
          'type': 'array',
          'title': 'List of users',
          'items': {
            'type': 'object',
            'properties': {
              'id': {
                'type': 'string',
                'title': 'User id',
              },
              'email': {
                'type': 'string',
                'title': 'User email',
                'format': 'email',
              },
            },
            'required': ['id', 'email'],
          },
        },
      },
      'required': ['users'],
    };
    return ajv.compile(adminListUsersResponseSchema);
  },

  getValidateAdminSubscribeReq: function () {
    const adminSubscribeRequestSchema = {
      '$schema': 'http://json-schema.org/draft-07/schema#',
      '$id': 'http://10.20.1.155:3000/adminsubscriberequest.schema.json',
      'title': 'Admin subscribe request',
      'description': 'Contains the request of admin_subscribe method',
      'type': 'object',
      'properties': {
        'v': {
          'title': 'API version',
          'description': 'FreeFall API version',
          'type': 'string',
        },
        'user_id': {
          'title': 'User id',
          'type': 'string',
        },
        'fly_from': {
          'title': 'Departure airport',
          'description': 'The id of the departure airport',
          'type': 'string',
        },
        'fly_to': {
          'title': 'Arrival airport',
          'description': 'The id of the arrival airport',
          'type': 'string',
        },
        'date_from': {
          'title': 'Earliest flight departure',
          'type': 'string',
          'format': 'date-time',
        },
        'date_to': {
          'title': 'Latest flight arrival',
          'type': 'string',
          'format': 'date-time',
        },
        'api_key': {
          'title': 'API key',
          'type': 'string',
        },
      },
      'required': ['v', 'user_id', 'fly_from', 'fly_to', 'date_from', 'date_to', 'api_key'],
    };
    return ajv.compile(adminSubscribeRequestSchema);
  },

  getValidateAdminUnsubscribeReq: function () {
    const adminUnsubscribeRequestSchema = {
      '$schema': 'http://json-schema.org/draft-07/schema#',
      '$id': 'http://10.20.1.155:3000/adminunsubscribereqest.schema.json',
      'title': 'Admin unsubscribe request',
      'description': 'Contains the request of admin_unsubscribe method',
      'oneOf': [
        {
          'type': 'object',
          'title': 'All subscriptions of user remove',
          'properties': {
            'v': {
              'type': 'string',
              'title': 'API version',
            },
            'user_id': {
              'type': 'string',
              'title': 'User ID',
            },
            'api_key': {
              'type': 'string',
              'title': 'API key',
            },
          },
          'required': ['v', 'user_id', 'api_key'],
        },
        {
          'type': 'object',
          'title': 'Remove subscription from user',
          'properties': {
            'v': {
              'type': 'string',
              'title': 'API version',
            },
            'user_subscription_id': {
              'type': 'string',
              'title': 'User subscription ID',
            },
            'api_key': {
              'type': 'string',
              'title': 'API key',
            },
          },
          'required': ['v', 'user_subscription_id', 'api_key'],
        },
      ],
    };
    return ajv.compile(adminUnsubscribeRequestSchema);
  },

  getValidateAdminSubscribeRes: function () {
    const adminSubscribeResponseSchema = {
      '$schema': 'http://json-schema.org/draft-07/schema#',
      '$id': 'http://10.20.1.155:3000/adminsubscriberesponse.schema.json',
      'title': 'Admin subscribe response',
      'description': 'Contains the response of admin_subscribe method',
      'type': 'object',
      'properties': {
        'subscription_id': {
          'title': 'Subscription id',
          'type': ['string', 'null'],
        },
        'status_code': {
          'title': 'Status code',
          'description': 'Indicator for the result of the request',
          'type': 'string',
        },
      },
      'required': ['status_code', 'subscription_id'],
    };
    return ajv.compile(adminSubscribeResponseSchema);
  },

  getValidateAdminUnsubscribeRes: function () {
    const adminUnsubscribeResponseSchema = {
      '$schema': 'http://json-schema.org/draft-07/schema#',
      '$id': 'http://10.20.1.155:3000/adminunsubscriberesponse.schema.json',
      'title': 'Admin unsubscribe response',
      'description': 'Contains the response of admin_unsubscribe method',
      'type': 'object',
      'properties': {
        'status_code': {
          'title': 'Status code',
          'description': 'Indicator for the result of the request',
          'type': 'string',
        },
      },
      'required': ['status_code'],
    };
    return ajv.compile(adminUnsubscribeResponseSchema);
  },

  getValidateGetAPIKeyReq: function () {
    const getAPIKeyRequestSchema = {
      '$schema': 'http://json-schema.org/draft-07/schema#',
      '$id': 'http://10.20.1.155:3000/getapikeyrequest.schema.json',
      'title': 'Get API key request',
      'type': 'object',
      'properties': {
        'v': {
          'title': 'API version',
          'type': 'string',
        },
      },
      'required': ['v'],
    };
    return ajv.compile(getAPIKeyRequestSchema);
  },

  getValidateGetAPIKeyRes: function () {
    const getAPIKeyResponseSchema = {
      '$schema': 'http://json-schema.org/draft-07/schema#',
      '$id': 'http://10.20.1.155:3000/getapikeyresponse.schema.json',
      'title': 'Get API key response',
      'type': 'object',
      'properties': {
        'api_key': {
          'type': ['string', 'null'],
          'title': 'API key',
        },
      },
      'required': ['api_key'],
    };
    return ajv.compile(getAPIKeyResponseSchema);
  },
};
