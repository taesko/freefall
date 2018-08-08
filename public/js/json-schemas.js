const ajv = new Ajv();

const validators = { // eslint-disable-line no-unused-vars
  getValidateSubscribeReq: function () {
    const subscribeRequestSchema = {
      '$schema': 'http://json-schema.org/draft-07/schema#',
      '$id': 'http://10.20.1.155:3000/subscriberequest.schema.json',
      'title': 'Subscribe request',
      'description': 'Contains the request of subscribe method',
      'type': 'object',
      'properties': {
        'v': {
          'title': 'API version',
          'description': 'FreeFall API version',
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
          'format': 'date',
        },
        'date_to': {
          'title': 'Latest flight arrival',
          'type': 'string',
          'format': 'date',
        },
        'api_key': {
          'title': 'API key',
          'type': 'string',
        },
      },
      'required': ['v', 'fly_from', 'fly_to', 'date_from', 'date_to', 'api_key'],
    };
    return ajv.compile(subscribeRequestSchema);
  },

  getValidateUnsubscribeReq: function () {
    const unsubscribeRequestSchema = {
      '$schema': 'http://json-schema.org/draft-07/schema#',
      '$id': 'http://10.20.1.155:3000/unsubscriberequest.schema.json',
      'title': 'Unsubscribe request',
      'description': 'Contains the request of unsubscribe method',
      'type': 'object',
      'properties': {
        'v': {
          'title': 'API version',
          'type': 'string',
        },
        'user_subscription_id': {
          'title': 'User subscription ID',
          'type': 'string',
        },
        'api_key': {
          'title': 'API key',
          'type': 'string',
        },
      },
      'required': ['v', 'api_key', 'user_subscription_id'],
    };
    return ajv.compile(unsubscribeRequestSchema);
  },

  getValidateUnsubscribeAllReq: function () {
    const unsubscribeAllRequestSchema = {
      '$schema': 'http://json-schema.org/draft-07/schema#',
      '$id': 'http://10.20.1.155:3000/unsubscribeallrequest.schema.json',
      'title': 'Unsubscribe all request',
      'description': 'Contains the request of unsubscribe all method',
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
      'required': ['v', 'api_key'],
    };
    return ajv.compile(unsubscribeAllRequestSchema);
  },

  getValidateSubscribeRes: function () {
    const subscribeResponseSchema = {
      '$schema': 'http://json-schema.org/draft-07/schema#',
      '$id': 'http://10.20.1.155:3000/subscriberesponse.schema.json',
      'title': 'Subscribe response',
      'description': 'Contains the response of subscribe method',
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
    return ajv.compile(subscribeResponseSchema);
  },

  getValidateUnsubscribeRes: function () {
    const unsubscribeResponseSchema = {
      '$schema': 'http://json-schema.org/draft-07/schema#',
      '$id': 'http://10.20.1.155:3000/unsubscriberesponse.schema.json',
      'title': 'Unsubscribe response',
      'description': 'Contains the response of unsubscribe method',
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
    return ajv.compile(unsubscribeResponseSchema);
  },

  getValidateSearchReq: function () {
    const searchRequestSchema = {
      '$schema': 'http://json-schema.org/draft-07/schema#',
      '$id': 'http://10.20.1.155:3000/searchrequest.schema.json',
      'title': 'Search request',
      'description': 'Contains the parameters for search',
      'type': 'object',
      'properties': {
        'v': {
          'title': 'API Version',
          'description': 'FreeFall API version',
          'type': 'string',
        },
        'fly_from': {
          'title': 'Departure airport id',
          'description': 'The id of the departure airport',
          'type': 'string',
        },
        'fly_to': {
          'title': 'Arrival airport id',
          'description': 'The id of the arrival airport',
          'type': 'string',
        },
        'price_to': {
          'title': 'Maximum price',
          'description': 'Filter for a maximum price',
          'type': 'number',
          'minimum': 0,
        },
        'currency': {
          'title': 'Currency',
          'description': 'The currency in which the data has to be in the response',
          'type': 'string',
          'enum': ['BGN', 'EUR', 'USD'],
        },
        'date_from': {
          'title': 'Date from',
          'description': 'Filter for the earliest flight departure',
          'type': 'string',
          'format': 'date',
        },
        'date_to': {
          'title': 'Date to',
          'description': 'Filter for the latest flight arrival',
          'type': 'string',
          'format': 'date',
        },
        'sort': {
          'title': 'Sort by',
          'description': 'Filter for how the data in the response should be sorted',
          'type': 'string',
          'enum': ['price', 'duration'],
        },
        'max_fly_duration': {
          'title': 'Maximum fly duration',
          'description': 'The maximum fly time in a route (sum of the duration of all flights in a route)',
          'type': 'number',
          'minimum': 0,
        },
        'limit': {
          'title': 'Results limit',
          'type': 'number',
          'minimum': 1,
          'maximum': 20,
        },
        'offset': {
          'title': 'Results offset',
          'type': 'number',
          'minimum': 0,
        },
      },
      'required': ['v', 'fly_from', 'fly_to', 'currency', 'sort'],
    };
    return ajv.compile(searchRequestSchema);
  },

  getValidateSearchRes: function () {
    const searchResponseSchema = {
      '$schema': 'http://json-schema.org/draft-07/schema#',
      '$id': 'http://10.20.1.155:3000/searchresponse.schema.json',
      'title': 'Search response',
      'description': 'Contains the response of search',
      'type': 'object',
      'properties': {
        'status_code': {
          'title': 'Status code',
          'description': 'Indicator for the result of the request',
          'type': ['string', 'number'],
        },
        'currency': {
          'title': 'Currency',
          'description': 'The currency in which the data in the response is',
          'type': 'string',
          'enum': ['BGN', 'EUR', 'USD'],
        },
        'routes': {
          'title': 'Routes',
          'description': 'An array of possible ways to travel between two airports',
          'type': 'array',
          'items': {
            'type': 'object',
            'properties': {
              'booking_token': {
                'title': 'Booking token',
                'description': 'Url to a page from where tickets for route can be bought',
                'type': 'string',
              },
              'price': {
                'title': 'Price',
                'description': 'The cost of the whole route',
                'type': 'number',
              },
              'route': {
                'title': 'Route',
                'description': 'An array, containing the flights in a route',
                'type': 'array',
                'items': {
                  'type': 'object',
                  'properties': {
                    'airport_from': {
                      'title': 'Departure airport',
                      'description': 'Departure airport',
                      'type': 'string',
                    },
                    'airport_to': {
                      'title': 'Arrival airport',
                      'description': 'Arrival airport',
                      'type': 'string',
                    },
                    'return': {
                      'title': 'Return',
                      'description': 'Boolean for flight direction - passenger going (false) or returning (true)',
                      'type': 'boolean',
                    },
                    'dtime': {
                      'title': 'Departure time',
                      'description': 'Departure time',
                      'type': 'string',
                      'format': 'date-time',
                    },
                    'atime': {
                      'title': 'Arrival time',
                      'description': 'Arrival time',
                      'type': 'string',
                      'format': 'date-time',
                    },
                    'airline_logo': {
                      'title': 'Airline logo',
                      'description': 'Url to the logo of the airline company providing the ticket',
                      'type': 'string',
                    },
                    'airline_name': {
                      'title': 'Airline name',
                      'description': 'The name of the airline',
                      'type': 'string',
                    },
                    'flight_number': {
                      'title': 'Flight number',
                      'description': 'The number of the flight',
                      'type': 'string',
                    },
                  },
                  'required': ['airport_from', 'airport_to', 'return', 'dtime', 'atime', 'airline_logo', 'airline_name', 'flight_number'],
                },
              },
            },
            'required': ['booking_token', 'price', 'route'],
          },
        },
      },
      'required': ['status_code', 'currency', 'routes'],
    };
    return ajv.compile(searchResponseSchema);
  },

  getValidateSendErrorReq: function () {
    const sendErrorRequestSchema = {
      '$schema': 'http://json-schema.org/draft-07/schema#',
      '$id': 'http://10.20.1.155:3000/senderrorrequest.schema.json',
      'title': 'Send error request',
      'description': 'Contains the response of sendError method',
      'type': 'object',
      'properties': {
        'v': {
          'title': 'API version',
          'description': 'FreeFall API version',
          'type': 'string',
        },
        'msg': {
          'title': 'Error message',
          'description': 'Message with information about the error',
          'type': 'string',
        },
        'trace': {
          'title': 'Trace',
          'description': 'Array of trace messages',
          'type': 'array',
          'items': {
            'type': 'string',
          },
        },
        'stack_trace': {
          'title': 'Stack trace',
          'type': 'string',
        },
      },
      'required': ['v', 'msg', 'trace', 'stack_trace'],
    };
    return ajv.compile(sendErrorRequestSchema);
  },

  getValidateSendErrorRes: function () {
    const sendErrorResponseSchema = {
      '$schema': 'http://json-schema.org/draft-07/schema#',
      '$id': 'http://10.20.1.155:3000/senderrorresponse.schema.json',
      'title': 'Send error response',
      'description': 'Contains the response of sendError method',
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
    return ajv.compile(sendErrorResponseSchema);
  },

  getValidateErrorRes: function () {
    const errorResponseSchema = {
      '$schema': 'http://json-schema.org/draft-07/schema#',
      '$id': 'http://10.20.1.155:3000/errorresponse.schema.json',
      'title': 'Send error response',
      'type': 'object',
      'properties': {
        'code': {
          'title': 'Error code',
          'type': 'number',
        },
        'message': {
          'title': 'Error message',
          'type': 'string',
        },
        'data': {
          'title': 'Error data',
          'type': 'object',
        },
      },
      'required': ['code', 'message', 'data'],
    };
    return ajv.compile(errorResponseSchema);
  },

  getValidateListAirportsReq: function () {
    const listAirportsRequestSchema = {
      '$schema': 'http://json-schema.org/draft-07/schema#',
      '$id': 'http://10.20.1.155:3000/listairportsrequest.schema.json',
      'title': 'List airports request',
      'type': 'object',
      'properties': {
        'v': {
          'title': 'API version',
          'type': 'string',
        },
      },
      'required': ['v'],
    };
    return ajv.compile(listAirportsRequestSchema);
  },

  getValidateListAirportsRes: function () {
    const listAirportsResponseSchema = {
      '$schema': 'http://json-schema.org/draft-07/schema#',
      '$id': 'http://10.20.1.155:3000/listairportsresponse.schema.json',
      'title': 'List airports response',
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
    return ajv.compile(listAirportsResponseSchema);
  },

  getValidateListSubscriptionsReq: function () {
    const validateSubscriptionsRequestSchema = {
      '$schema': 'http://json-schema.org/draft-07/schema#',
      '$id': 'http://10.20.1.155:3000/listsubscriptionsrequest.schema.json',
      'title': 'List subscriptions request',
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
      'required': ['v', 'api_key'],
    };
    return ajv.compile(validateSubscriptionsRequestSchema);
  },

  getValidateListSubscriptionsRes: function () {
    const validateSubscriptionsResponseSchema = {
      '$schema': 'http://json-schema.org/draft-07/schema#',
      '$id': 'http://10.20.1.155:3000/listsubscriptionsresponse.schema.json',
      'title': 'List subscriptions response',
      'type': 'object',
      'properties': {
        'subscriptions': {
          'type': 'array',
          'title': 'Subscriptions list',
          'items': {
            'type': 'object',
            'properties': {
              'id': {
                'title': 'Subscription id',
                'type': 'string',
              },
              'fly_from': {
                'title': 'Departure airport database id',
                'type': 'string',
              },
              'fly_to': {
                'title': 'Arrival airport database id',
                'type': 'string',
              },
              'date_from': {
                'title': 'Earliest flight departure',
                'type': 'string',
                'format': 'date',
              },
              'date_to': {
                'title': 'Latest flight arrival',
                'type': 'string',
                'format': 'date',
              },
            },
            'required': ['id', 'fly_from', 'fly_to', 'date_from', 'date_to'],
          },
        },
      },
      'required': ['subscriptions'],
    };
    return ajv.compile(validateSubscriptionsResponseSchema);
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

  getValidateEditSubscriptionReq: function () {
    const editSubscriptionRequestSchema = {
      '$schema': 'http://json-schema.org/draft-07/schema#',
      '$id': 'request/edit_subscription',
      'title': 'Body of the edit_subscription API method sent from the client',
      'type': 'object',
      'properties': {
        'v': {
          'type': 'string',
        },
        'api_key': {
          'type': 'string',
        },
        'user_subscription_id': {
          'type': 'string',
        },
        'fly_from': {
          'type': 'string',
        },
        'fly_to': {
          'type': 'string',
        },
        'date_from': {
          'type': 'string',
        },
        'date_to': {
          'type': 'string',
        },
      },
      'required': [
        'v',
        'user_subscription_id',
        'api_key',
        'fly_from',
        'fly_to',
        'date_from',
        'date_to',
      ],
    };
    return ajv.compile(editSubscriptionRequestSchema);
  },

  getValidateEditSubscriptionRes: function () {
    const editSubscriptionResponseSchema = {
      '$schema': 'http://json-schema.org/draft-07/schema#',
      '$id': 'response/edit_subscription',
      'title': 'API response of edit_subscription method',
      'type': 'object',
      'properties': {
        'status_code': {
          'type': 'string',
        },
      },
    };
    return ajv.compile(editSubscriptionResponseSchema);
  },
};
