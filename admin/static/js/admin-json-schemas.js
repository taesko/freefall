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
      '$id': 'http://10.20.1.155:3000/adminlistsubscriptionsrequest.schema.json',
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
      'required': ['v', 'api_key'],
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
                'format': 'date',
              },
              'date_to': {
                'type': 'string',
                'title': 'Latest arrival time',
                'format': 'date',
              },
              'created_at': {
                'title': 'Created at',
                'type': 'string',
              },
              'updated_at': {
                'title': 'Updated at',
                'type': 'string',
              },
            },
            'required': [
              'id',
              'user',
              'fly_from',
              'fly_to',
              'date_from',
              'date_to',
              'created_at',
              'updated_at',
            ],
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
              'created_at': {
                'title': 'Created at',
                'type': 'string',
              },
              'updated_at': {
                'title': 'Updated at',
                'type': 'string',
              },
            },
            'required': [
              'id',
              'fly_from',
              'fly_to',
              'created_at',
              'updated_at',
            ],
          },
        },
      },
      'required': ['user_subscriptions', 'guest_subscriptions'],
    };
    return ajv.compile(adminListSubscriptionsResponseSchema);
  },

  getValidateAdminListUserSubscriptionsReq: function () {
    const adminListUserSubscriptionsRequestSchema = {
      '$schema': 'http://json-schema.org/draft-07/schema#',
      '$id': 'request/admin_list_user_subscriptions',
      'title': 'Admin list user subscriptions request',
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
        'limit': {
          'title': 'Limit',
          'type': 'integer',
          'minimum': 1,
          'maximum': 100,
        },
        'offset': {
          'title': 'Offset',
          'type': 'integer',
          'minimum': 0,
        },
        'api_key': {
          'title': 'API key',
          'type': 'string',
        },
      },
      'required': [
        'v',
        'api_key',
        'limit',
        'offset',
      ],
    };

    return ajv.compile(adminListUserSubscriptionsRequestSchema);
  },

  getValidateAdminListUserSubscriptionsRes: function () {
    const adminListUserSubscriptionsResponseSchema = {
      '$schema': 'http://json-schema.org/draft-07/schema#',
      '$id': 'response/admin_list_user_subscriptions',
      'title': 'Admin list user subscriptions response',
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
                'format': 'date',
              },
              'date_to': {
                'type': 'string',
                'title': 'Latest arrival time',
                'format': 'date',
              },
              'created_at': {
                'title': 'Created at',
                'type': 'string',
              },
              'updated_at': {
                'title': 'Updated at',
                'type': 'string',
              },
            },
            'required': [
              'id',
              'user',
              'fly_from',
              'fly_to',
              'date_from',
              'date_to',
              'created_at',
              'updated_at',
            ],
          },
        },
      },
      'required': [
        'user_subscriptions',
      ],
    };

    return ajv.compile(adminListUserSubscriptionsResponseSchema);
  },

  getValidateAdminListGuestSubscriptionsReq: function () {
    const adminListGuestSubscriptionsRequestSchema = {
      '$schema': 'http://json-schema.org/draft-07/schema#',
      '$id': 'request/admin_list_guest_subscriptions',
      'title': 'Admin list guest subscriptions request',
      'type': 'object',
      'properties': {
        'v': {
          'title': 'API version',
          'type': 'string',
        },
        'limit': {
          'title': 'Limit',
          'type': 'integer',
          'minimum': 1,
          'maximum': 100,
        },
        'offset': {
          'title': 'Offset',
          'type': 'integer',
          'minimum': 0,
        },
        'api_key': {
          'title': 'API key',
          'type': 'string',
        },
      },
      'required': [
        'v',
        'api_key',
        'limit',
        'offset',
      ],
    };
    return ajv.compile(adminListGuestSubscriptionsRequestSchema);
  },

  getValidateAdminListGuestSubscriptionsRes: function () {
    const adminListGuestSubscriptionsResponseSchema = {
      '$schema': 'http://json-schema.org/draft-07/schema#',
      '$id': 'response/admin_list_guest_subscriptions',
      'title': 'Admin list guest subscriptions response',
      'type': 'object',
      'properties': {
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
              'created_at': {
                'title': 'Created at',
                'type': 'string',
              },
              'updated_at': {
                'title': 'Updated at',
                'type': 'string',
              },
            },
            'required': [
              'id',
              'fly_from',
              'fly_to',
              'created_at',
              'updated_at',
            ],
          },
        },
      },
      'required': [
        'guest_subscriptions',
      ],
    };
    return ajv.compile(adminListGuestSubscriptionsResponseSchema);
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
        'limit': {
          'type': 'integer',
          'title': 'Limit',
          'minimum': 1,
          'maximum': 20,
        },
        'offset': {
          'type': 'integer',
          'title': 'Offset',
          'minimum': 0,
        },
        'api_key': {
          'type': 'string',
          'title': 'API key',
        },
      },
      'required': [
        'v',
        'api_key',
        'limit',
        'offset',
      ],
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
              },
              'credits': {
                'type': 'number',
                'title': 'User credits',
                'minimum': 0,
              },
              'api_key': {
                'title': 'API key',
                'type': 'string',
              },
              'verified': {
                'title': 'Verified',
                'type': 'boolean',
              },
              'verification_token': {
                'title': 'Verification token',
                'type': 'string',
              },
              'active': {
                'title': 'Active',
                'type': 'boolean',
              },
            },
            'required': [
              'id',
              'email',
              'credits',
              'api_key',
              'verified',
              'verification_token',
              'active',
            ],
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

  getValidateAdminRemoveUserReq: function () {
    const adminRemoveUserRequestSchema = {
      '$schema': 'http://json-schema.org/draft-07/schema#',
      '$id': 'http://10.20.1.155:3000/adminremoveuserrequest.schema.json',
      'title': 'Admin remove user request',
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
        'user_id': {
          'type': 'string',
          'title': 'Database id of the user.',
        },
      },
      'required': [
        'v',
        'api_key',
        'user_id',
      ],
    };
    return ajv.compile(adminRemoveUserRequestSchema);
  },

  getValidateAdminRemoveUserRes: function () {
    const adminRemoveUserResponseSchema = {
      '$schema': 'http://json-schema.org/draft-07/schema#',
      '$id': 'http://10.20.1.155:3000/adminremoveuserresponse.schema.json',
      'title': 'Admin remove user response',
      'description': 'Contains the response of admin_unsubscribe method',
      'type': 'object',
      'properties': {
        'status_code': {
          'title': 'Status code',
          'description': 'Indicator whether removal was successful.',
          'type': 'string',
        },
      },
      'required': [
        'status_code',
      ],
    };
    return ajv.compile(adminRemoveUserResponseSchema);
  },

  getValidateAdminEditUserReq: function () {
    const adminEditUserRequestSchema = {
      '$schema': 'http://json-schema.org/draft-07/schema#',
      '$id': 'request/admin_edit_user',
      'title': 'admin_edit_user request',
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
        'user_id': {
          'title': 'Database id of the user to delete.',
          'type': 'string',
        },
        'email': {
          'title': 'Optional new email of the user',
          'type': 'string',
        },
        'password': {
          'title': 'Optional new password of the user',
          'type': 'string',
        },
        'role': {
          'title': 'Role',
          'type': 'integer',
        },
      },
      'any_of': [
        {
          'required': [
            'v',
            'api_key',
            'email',
          ],
        },
        {
          'required': [
            'v',
            'api_key',
            'password',
          ],
        },
        {
          'required': [
            'v',
            'api_key',
            'email',
            'password',
          ],
        },
      ],
    };
    return ajv.compile(adminEditUserRequestSchema);
  },

  getValidateAdminEditUserRes: function () {
    const adminEditUserResponseSchema = {
      '$schema': 'http://json-schema.org/draft-07/schema#',
      '$id': 'response/admin_edit_user',
      'title': 'admin_edit_user response',
      'type': 'object',
      'properties': {
        'status_code': {
          'title': 'Status code',
          'type': 'string',
        },
      },
      'required': [
        'status_code',
      ],
    };
    return ajv.compile(adminEditUserResponseSchema);
  },

  getValidateAdminEditSubscriptionReq: function () {
    const adminEditSubscriptionRequestSchema = {
      '$schema': 'http://json-schema.org/draft-07/schema#',
      '$id': 'request/admin_edit_subscription',
      'title': 'Admin edit subscription response',
      'type': 'object',
      'properties': {
        'v': {
          'title': 'API version',
          'type': 'string',
        },
        'user_subscription_id': {
          'title': 'User subscription id in the database',
          'type': 'string',
        },
        'api_key': {
          'title': 'API key',
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
      },
      'required': [
        'v',
        'api_key',
      ],
    };
    return ajv.compile(adminEditSubscriptionRequestSchema);
  },

  getValidateAdminEditSubscriptionRes: function () {
    const adminEditSubscriptionResponseSchema = {
      '$schema': 'http://json-schema.org/draft-07/schema#',
      '$id': 'response/admin_edit_subscription',
      'title': 'admin_edit_subscription response',
      'type': 'object',
      'properties': {
        'updated_at': {
          'title': 'Updated at',
          'type': 'string',
          'format': 'date-time',
        },
        'status_code': {
          'title': 'Status code',
          'type': 'string',
        },
      },
      'required': [
        'status_code',
      ],
    };
    return ajv.compile(adminEditSubscriptionResponseSchema);
  },

  getValidateAdminAlterUserCreditsReq: function () {
    const adminAlterUserCreditsRequestSchema = {
      '$schema': 'http://json-schema.org/draft-07/schema#',
      '$id': 'request/admin_alter_user_credits',
      'title': 'admin_alter_user_credits request',
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
        'credits_difference': {
          'title': 'Credits difference',
          'type': 'number',
        },
        'api_key': {
          'title': 'API key',
          'type': 'string',
        },
      },
      'required': ['v', 'user_id', 'credits_difference', 'api_key'],
    };
    return ajv.compile(adminAlterUserCreditsRequestSchema);
  },

  getValidateAdminAlterUserCreditsRes: function () {
    const adminAlterUserCreditsResponseSchema = {
      '$schema': 'http://json-schema.org/draft-07/schema#',
      '$id': 'response/admin_alter_user_credits',
      'title': 'admin_alter_user_credits response',
      'type': 'object',
      'properties': {
        'status_code': {
          'title': 'Status code',
          'type': 'string',
        },
      },
      'required': ['status_code'],
    };
    return ajv.compile(adminAlterUserCreditsResponseSchema);
  },

  getValidateAdminAddRoleReq: function () {
    const adminAddRoleRequestSchema = {
      '$schema': 'http://json-schema.org/draft-07/schema#',
      '$id': 'request/admin_add_role',
      'title': 'Admin add role request API method',
      'description': 'Body of the admin_add_role API method',
      'type': 'object',
      'properties': {
        'v': {
          'type': 'string',
          'title': 'API version',
        },
        'role_name': {
          'type': 'string',
          'title': 'Role name',
        },
        'permissions': {
          'type': 'array',
          'title': 'Permissions',
          'items': {
            'type': 'integer',
          },
        },
        'api_key': {
          'type': 'string',
          'title': 'API key',
        },
      },
      'required': [
        'v',
        'role_name',
        'permissions',
        'api_key',
      ],
    };
    return ajv.compile(adminAddRoleRequestSchema);
  },

  getValidateAdminAddRoleRes: function () {
    const adminAddRoleResponseSchema = {
      '$schema': 'http://json-schema.org/draft-07/schema#',
      '$id': 'response/admin_add_role',
      'title': 'Admin add role response',
      'description': 'Contains the response of admin_add_role method',
      'type': 'object',
      'properties': {
        'status_code': {
          'title': 'Status code',
          'description': 'Indicator for the result of the request',
          'type': 'string',
        },
        'role_id': {
          'title': 'Role id',
          'type': ['integer', 'null'],
        },
      },
      'required': [
        'status_code',
        'role_id',
      ],
    };
    return ajv.compile(adminAddRoleResponseSchema);
  },

  getValidateAdminEditRoleReq: function () {
    const adminEditRoleRequestSchema = {
      '$schema': 'http://json-schema.org/draft-07/schema#',
      '$id': 'request/admin_edit_role',
      'title': 'Admin edit role request API method',
      'description': 'Body of the admin_edit_role API method',
      'type': 'object',
      'properties': {
        'v': {
          'type': 'string',
          'title': 'API version',
        },
        'role_id': {
          'type': 'integer',
          'title': 'Role id',
        },
        'role_name': {
          'type': 'string',
          'title': 'Role name',
        },
        'permissions': {
          'type': 'array',
          'title': 'Permissions',
          'items': {
            'type': 'integer',
          },
        },
        'api_key': {
          'type': 'string',
          'title': 'API key',
        },
      },
      'required': [
        'v',
        'role_id',
        'api_key',
      ],
    };
    return ajv.compile(adminEditRoleRequestSchema);
  },

  getValidateAdminEditRoleRes: function () {
    const adminEditRoleResponseSchema = {
      '$schema': 'http://json-schema.org/draft-07/schema#',
      '$id': 'response/admin_edit_role',
      'title': 'Admin edit role response',
      'description': 'Contains the response of admin_edit_role method',
      'type': 'object',
      'properties': {
        'status_code': {
          'title': 'Status code',
          'description': 'Indicator for the result of the request',
          'type': 'string',
        },
        'updated_at': {
          'title': 'Updated at',
          'type': ['null', 'string'],
        },
      },
      'required': [
        'status_code',
        'updated_at',
      ],
    };
    return ajv.compile(adminEditRoleResponseSchema);
  },

  getValidateAdminListPermissionsReq: function () {
    const adminListPermissionsRequestSchema = {
      '$schema': 'http://json-schema.org/draft-07/schema#',
      '$id': 'request/admin_list_permissions',
      'title': 'Admin list permissions request',
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
      'required': [
        'v',
        'api_key',
      ],
    };
    return ajv.compile(adminListPermissionsRequestSchema);
  },

  getValidateAdminListPermissionsRes: function () {
    const adminListPermissionsResponseSchema = {
      '$schema': 'http://json-schema.org/draft-07/schema#',
      '$id': 'response/admin_list_permissions',
      'title': 'Admin list permissions response',
      'description': 'Contains the response of admin_list_permissions method',
      'type': 'object',
      'properties': {
        'status_code': {
          'title': 'Status code',
          'description': 'Indicator for the result of the request',
          'type': 'string',
        },
        'permissions': {
          'title': 'Permissions',
          'type': 'array',
          'items': {
            'title': 'Permission',
            'type': 'object',
            'properties': {
              'name': {
                'title': 'Permission name',
                'type': 'string',
              },
              'id': {
                'title': 'Permission id',
                'type': 'integer',
              },
              'created_at': {
                'title': 'Created at',
                'type': 'string',
                'format': 'date-time',
              },
              'updated_at': {
                'title': 'Updated at',
                'type': 'string',
                'format': 'date-time',
              },
            },
            'required': [
              'name',
              'id',
              'created_at',
              'updated_at',
            ],
          },
        },
      },
      'required': [
        'status_code',
        'permissions',
      ],
    };
    return ajv.compile(adminListPermissionsResponseSchema);
  },

  getValidateAdminListRolesReq: function () {
    const adminListRolesRequestSchema = {
      '$schema': 'http://json-schema.org/draft-07/schema#',
      '$id': 'request/admin_list_roles',
      'title': 'Admin list roles request',
      'type': 'object',
      'properties': {
        'v': {
          'type': 'string',
          'title': 'API version',
        },
        'role_id': {
          'type': 'integer',
          'title': 'Role id',
        },
        'limit': {
          'type': 'integer',
          'title': 'Limit',
          'minimum': 1,
          'maximum': 20,
        },
        'offset': {
          'type': 'integer',
          'title': 'Offset',
          'minimum': 0,
        },
        'api_key': {
          'type': 'string',
          'title': 'API key',
        },
      },
      'required': [
        'v',
        'api_key',
        'limit',
        'offset',
      ],
    };
    return ajv.compile(adminListRolesRequestSchema);
  },

  getValidateAdminListRolesRes: function () {
    const adminListRolesResponseSchema = {
      '$schema': 'http://json-schema.org/draft-07/schema#',
      '$id': 'response/admin_list_roles',
      'title': 'Admin list roles response',
      'description': 'Contains the response of admin_list_roles method',
      'type': 'object',
      'properties': {
        'status_code': {
          'title': 'Status code',
          'description': 'Indicator for the result of the request',
          'type': 'string',
        },
        'roles': {
          'title': 'Roles',
          'type': 'array',
          'items': {
            'title': 'Role',
            'type': 'object',
            'properties': {
              'id': {
                'title': 'Role id',
                'type': 'integer',
              },
              'name': {
                'title': 'Role name',
                'type': 'string',
              },
              'permissions': {
                'title': 'Permissions',
                'type': 'array',
                'items': {
                  'title': 'Permission',
                  'type': 'integer',
                },
              },
              'created_at': {
                'title': 'Created at',
                'type': 'string',
                'format': 'date-time',
              },
              'updated_at': {
                'title': 'Updated at',
                'type': 'string',
                'format': 'date-time',
              },
            },
            'required': [
              'id',
              'name',
              'permissions',
              'created_at',
              'updated_at',
            ],
          },
        },
      },
      'required': [
        'status_code',
        'roles',
      ],
    };
    return ajv.compile(adminListRolesResponseSchema);
  },

  getValidateAdminRemoveRoleReq: function () {
    const adminRemoveRoleRequestSchema = {
      '$schema': 'http://json-schema.org/draft-07/schema#',
      '$id': 'request/admin_remove_role',
      'title': 'Admin remove role request API method',
      'description': 'Body of the admin_remove_role API method',
      'type': 'object',
      'properties': {
        'v': {
          'type': 'string',
          'title': 'API version',
        },
        'role_id': {
          'type': 'integer',
          'title': 'Role id',
        },
        'api_key': {
          'type': 'string',
          'title': 'API key',
        },
      },
      'required': [
        'v',
        'role_id',
        'api_key',
      ],
    };
    return ajv.compile(adminRemoveRoleRequestSchema);
  },

  getValidateAdminRemoveRoleRes: function () {
    const adminRemoveRoleResponseSchema = {
      '$schema': 'http://json-schema.org/draft-07/schema#',
      '$id': 'response/admin_remove_role',
      'title': 'Admin remove role response',
      'description': 'Contains the response of admin_remove_role method',
      'type': 'object',
      'properties': {
        'status_code': {
          'title': 'Status code',
          'description': 'Indicator for the result of the request',
          'type': 'string',
        },
      },
      'required': [
        'status_code',
      ],
    };
    return ajv.compile(adminRemoveRoleResponseSchema);
  },

  getValidateAdminAddEmployeeReq: function () {
    const adminAddEmployeeRequestSchema = {
      '$schema': 'http://json-schema.org/draft-07/schema#',
      '$id': 'request/admin_add_employee',
      'title': 'Admin add employee request',
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
        'email': {
          'type': 'string',
          'title': 'Email',
        },
        'password': {
          'type': 'string',
          'title': 'Password',
        },
        'role_id': {
          'type': 'integer',
          'title': 'Role id',
        },
      },
      'required': [
        'v',
        'api_key',
        'email',
        'password',
        'role_id',
      ],
    };
    return ajv.compile(adminAddEmployeeRequestSchema);
  },

  getValidateAdminAddEmployeeRes: function () {
    const adminAddEmployeeResponseSchema = {
      '$schema': 'http://json-schema.org/draft-07/schema#',
      '$id': 'response/admin_add_employee',
      'title': 'Admin add employee response',
      'type': 'object',
      'properties': {
        'status_code': {
          'title': 'Status code',
          'type': 'string',
        },
        'employee': {
          'title': 'New employee',
          'oneOf': [
            {
              'type': 'null',
            },
            {
              'type': 'object',
              'properties': {
                'id': {
                  'title': 'Employee id',
                  'type': 'string',
                },
                'email': {
                  'title': 'Email',
                  'type': 'string',
                },
                'active': {
                  'title': 'Is active',
                  'type': 'boolean',
                },
                'role_id': {
                  'title': 'Role id',
                  'type': 'integer',
                },
                'role_updated_at': {
                  'title': 'Role updated at',
                  'type': 'string',
                },
              },
              'required': [
                'id',
                'email',
                'active',
                'role_id',
                'role_updated_at',
              ],
            },
          ],
        },
      },
      'required': [
        'status_code',
        'employee',
      ],
    };
    return ajv.compile(adminAddEmployeeResponseSchema);
  },

  getValidateAdminEditEmployeeReq: function () {
    const adminEditEmployeeRequestSchema = {
      '$schema': 'http://json-schema.org/draft-07/schema#',
      '$id': 'request/admin_edit_employee',
      'title': 'Admin edit employee request',
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
        'email': {
          'type': 'string',
          'title': 'Email',
        },
        'password': {
          'type': 'string',
          'title': 'Password',
        },
        'role_id': {
          'type': 'integer',
          'title': 'Role id',
        },
        'employee_id': {
          'type': 'string',
          'title': 'Employee id',
        },
      },
      'required': [
        'v',
        'api_key',
        'employee_id',
      ],
    };
    return ajv.compile(adminEditEmployeeRequestSchema);
  },

  getValidateAdminEditEmployeeRes: function () {
    const adminEditEmployeeResponseSchema = {
      '$schema': 'http://json-schema.org/draft-07/schema#',
      '$id': 'response/admin_edit_employee',
      'title': 'Admin edit employee response',
      'type': 'object',
      'properties': {
        'status_code': {
          'title': 'Status code',
          'type': 'string',
        },
        'employee': {
          'title': 'Edited employee',
          'oneOf': [
            {
              'type': 'null',
            },
            {
              'type': 'object',
              'properties': {
                'id': {
                  'title': 'Employee id',
                  'type': 'string',
                },
                'email': {
                  'title': 'Email',
                  'type': 'string',
                },
                'active': {
                  'title': 'Is active',
                  'type': 'boolean',
                },
                'role_id': {
                  'title': 'Role id',
                  'type': 'integer',
                },
                'role_updated_at': {
                  'title': 'Role updated at',
                  'type': 'string',
                },
              },
              'required': [
                'id',
                'email',
                'active',
                'role_id',
                'role_updated_at',
              ],
            },
          ],
        },
      },
      'required': [
        'status_code',
        'employee',
      ],
    };
    return ajv.compile(adminEditEmployeeResponseSchema);
  },

  getValidateAdminRemoveEmployeeReq: function () {
    const adminRemoveEmployeeRequestSchema = {
      '$schema': 'http://json-schema.org/draft-07/schema#',
      '$id': 'request/admin_remove_employee',
      'title': 'Admin remove employee request',
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
        'employee_id': {
          'type': 'string',
          'title': 'Employee id',
        },
      },
      'required': [
        'v',
        'api_key',
        'employee_id',
      ],
    };
    return ajv.compile(adminRemoveEmployeeRequestSchema);
  },

  getValidateAdminRemoveEmployeeRes: function () {
    const adminRemoveEmployeeResponseSchema = {
      '$schema': 'http://json-schema.org/draft-07/schema#',
      '$id': 'response/admin_remove_employee',
      'title': 'Admin remove employee response',
      'type': 'object',
      'properties': {
        'status_code': {
          'title': 'Status code',
          'type': 'string',
        },
      },
      'required': [
        'status_code',
      ],
    };
    return ajv.compile(adminRemoveEmployeeResponseSchema);
  },

  getValidateAdminListEmployeesReq: function () {
    const adminListEmployeesRequestSchema = {
      '$schema': 'http://json-schema.org/draft-07/schema#',
      '$id': 'request/admin_list_employees',
      'title': 'Admin list employees',
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
        'limit': {
          'type': 'integer',
          'title': 'Limit',
          'min': 1,
          'max': 20,
        },
        'offset': {
          'type': 'integer',
          'title': 'Offset',
          'min': 0,
        },
      },
      'required': [
        'v',
        'api_key',
        'limit',
        'offset',
      ],
    };
    return ajv.compile(adminListEmployeesRequestSchema);
  },

  getValidateAdminListEmployeesRes: function () {
    const adminListEmployeesResponseSchema = {
      '$schema': 'http://json-schema.org/draft-07/schema#',
      '$id': 'response/admin_list_employees',
      'title': 'Admin list employees response',
      'type': 'object',
      'properties': {
        'status_code': {
          'title': 'Status code',
          'type': 'string',
        },
        'employees': {
          'title': 'Employees',
          'type': 'array',
          'items': {
            'title': 'Employee',
            'type': 'object',
            'properties': {
              'id': {
                'title': 'Employee id',
                'type': 'string',
              },
              'email': {
                'title': 'Email',
                'type': 'string',
              },
              'active': {
                'title': 'Is active',
                'type': 'boolean',
              },
              'role_id': {
                'title': 'Role id',
                'type': 'integer',
              },
              'role_updated_at': {
                'title': 'Role updated at',
                'type': 'string',
              },
            },
            'required': [
              'id',
              'email',
              'active',
              'role_id',
              'role_updated_at',
            ],
          },
        },
      },
      'required': [
        'status_code',
        'employees',
      ],
    };
    return ajv.compile(adminListEmployeesResponseSchema);
  },

  getValidateAdminListAccountTransfersReq: function () {
    const adminListAccountTransfersRequestSchema = {
      '$schema': 'http://json-schema.org/draft-07/schema#',
      '$id': 'request/admin_list_account_transfers',
      'title': 'Admin list account transfers request',
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
        'filters': {
          'title': 'Filters',
          'type': 'object',
          'properties': {
            'user': {
              'title': 'User email filter',
              'type': 'string',
            },
            'transferred_at_from': {
              'title': 'Transferred at from filter',
              'type': 'string',
            },
            'transferred_at_to': {
              'title': 'Transferred at to filter',
              'type': 'string',
            },
            'type': {
              'title': 'Account transfer type filter',
              'type': 'string',
              'enum': [
                'all',
                'deposits',
                'withdrawals',
              ],
            },
            'reason': {
              'title': 'Account transfer reason filter',
              'type': 'string',
              'enum': [
                'all',
                'employee',
                'new-subscription',
                'fetch',
              ],
            },
            'subscr_airport_from': {
              'title': 'Subscription departure airport filter',
              'type': 'string',
            },
            'subscr_airport_to': {
              'title': 'Subscription arrival airport filter',
              'type': 'string',
            },
            'fetch_time_from': {
              'title': 'Subscription fetch time from filter',
              'type': 'string',
            },
            'fetch_time_to': {
              'title': 'Subscription fetch time to filter',
              'type': 'string',
            },
            'employee_email': {
              'title': 'Employee transferrer email filter',
              'type': 'string',
            },
            'user_subscr_airport_from': {
              'title': 'User subscription departure airport filter',
              'type': 'string',
            },
            'user_subscr_airport_to': {
              'title': 'User subscription arrival airport filter',
              'type': 'string',
            },
            'user_subscr_depart_time_from': {
              'title': 'User subscription departure time from filter',
              'type': 'string',
            },
            'user_subscr_depart_time_to': {
              'title': 'User subscription departure time to filter',
              'type': 'string',
            },
            'user_subscr_arrival_time_from': {
              'title': 'User subscription arrival time from filter',
              'type': 'string',
            },
            'user_subscr_arrival_time_to': {
              'title': 'User subscription arrival time to filter',
              'type': 'string',
            },
          },
        },
        'groupings': {
          'title': 'Groupings',
          'type': 'object',
          'properties': {
            'user': {
              'title': 'User grouping',
              'type': 'string',
              'enum': [
                'none',
                'user',
              ],
            },
            'transferred_at': {
              'title': 'Transferred at grouping',
              'type': 'string',
              'enum': [
                'none',
                'second',
                'minute',
                'hour',
                'day',
                'week',
                'month',
                'year',
              ],
            },
            'type': {
              'title': 'Transfer type grouping',
              'type': 'string',
              'enum': [
                'none',
                'type',
              ],
            },
            'reason': {
              'title': 'Transfer reason grouping',
              'type': 'string',
              'enum': [
                'none',
                'reason',
              ],
            },
            'employee': {
              'title': 'Employee grouping',
              'type': 'string',
              'enum': [
                'none',
                'employee',
              ],
            },
            'user_subscr_airport_from': {
              'title': 'User subscription airport from grouping',
              'type': 'string',
              'enum': [
                'none',
                'airport',
              ],
            },
            'user_subscr_airport_to': {
              'title': 'User subscription airport to grouping',
              'type': 'string',
              'enum': [
                'none',
                'airport',
              ],
            },
            'user_subscr_date_from': {
              'title': 'User subscription date from grouping',
              'type': 'string',
              'enum': [
                'none',
                'week',
                'month',
                'year',
              ],
            },
            'user_subscr_date_to': {
              'title': 'User subscription date to grouping',
              'type': 'string',
              'enum': [
                'none',
                'week',
                'month',
                'year',
              ],
            },
            'subscr_airport_from': {
              'title': 'Subscription airport from grouping',
              'type': 'string',
              'enum': [
                'none',
                'airport',
              ],
            },
            'subscr_airport_to': {
              'title': 'Subscription airport to grouping',
              'type': 'string',
              'enum': [
                'none',
                'airport',
              ],
            },
            'fetch_time': {
              'title': 'Fetch time grouping',
              'type': 'string',
              'enum': [
                'none',
                'second',
                'minute',
                'hour',
                'day',
                'week',
                'month',
                'year',
              ],
            },
          },
          'required': [
            'user',
            'transferred_at',
            'type',
            'reason',
            'employee',
            'user_subscr_airport_from',
            'user_subscr_airport_to',
            'user_subscr_date_from',
            'user_subscr_date_to',
            'subscr_airport_from',
            'subscr_airport_to',
            'fetch_time',
          ],
        },
      },
      'required': [
        'v',
        'api_key',
        'filters',
        'groupings',
      ],
    };
    return ajv.compile(adminListAccountTransfersRequestSchema);
  },

  getValidateAdminListAccountTransfersRes: function () {
    const adminListAccountTransfersResponseSchema = {
      '$schema': 'http://json-schema.org/draft-07/schema#',
      '$id': 'response/admin_list_account_transfers',
      'title': 'Admin list account transfers response',
      'type': 'object',
      'properties': {
        'status_code': {
          'title': 'Status code',
          'type': 'string',
        },
        'account_transfers': {
          'title': 'Account transfers',
          'type': 'array',
          'items': {
            'title': 'Account transfer',
            'type': 'object',
            'properties': {
              'account_owner_id': {
                'title': 'Account owner id',
                'type': [
                  'null',
                  'string',
                ],
              },
              'account_owner_email': {
                'title': 'Account owner email',
                'type': [
                  'null',
                  'string',
                ],
              },
              'deposit_amount': {
                'title': 'Deposit amount',
                'type': [
                  'null',
                  'integer',
                ],
              },
              'withdrawal_amount': {
                'title': 'Withdrawal amount',
                'type': [
                  'null',
                  'integer',
                ],
              },
              'transferred_at': {
                'title': 'Transferred_at',
                'type': [
                  'null',
                  'string',
                ],
              },
              'type': {
                'title': 'Transfer type',
                'type': [
                  'null',
                  'string',
                ],
              },
              'reason': {
                'title': 'Transfer reason',
                'type': [
                  'null',
                  'string',
                ],
              },
              'employee_transferrer_id': {
                'title': 'Employee transferrer id',
                'type': [
                  'null',
                  'string',
                ],
              },
              'employee_transferrer_email': {
                'title': 'Employee transferrer email',
                'type': [
                  'null',
                  'string',
                ],
              },
              'user_subscr_airport_from_name': {
                'title': 'User subscription airport from name',
                'type': [
                  'null',
                  'string',
                ],
              },
              'user_subscr_airport_to_name': {
                'title': 'User subscription airport to name',
                'type': [
                  'null',
                  'string',
                ],
              },
              'user_subscr_date_from': {
                'title': 'User subscription date from',
                'type': [
                  'null',
                  'string',
                ],
              },
              'user_subscr_date_to': {
                'title': 'User subscription date to',
                'type': [
                  'null',
                  'string',
                ],
              },
              'subscr_airport_from_name': {
                'title': 'Subscription airport from name',
                'type': [
                  'null',
                  'string',
                ],
              },
              'subscr_airport_to_name': {
                'title': 'Subscription airport to name',
                'type': [
                  'null',
                  'string',
                ],
              },
              'fetch_time': {
                'title': 'Fetch time',
                'type': [
                  'null',
                  'string',
                ],
              },
              'grouped_amount': {
                'title': 'Grouped amount',
                'type': [
                  'null',
                  'string',
                ],
              },
            },
          },
        },
        'active_columns': {
          'title': 'Active columns',
          'type': 'array',
          'items': {
            'title': 'Active column',
            'type': 'string',
          },
        },
      },
      'required': [
        'status_code',
        'account_transfers',
        'active_columns',
      ],
    };
    return ajv.compile(adminListAccountTransfersResponseSchema);
  },

  getValidateAdminGetAPIKeyReq: function () {
    const adminGetAPIKeyRequestSchema = {
      '$schema': 'http://json-schema.org/draft-07/schema#',
      '$id': 'request/admin_get_api_key',
      'title': 'Admin get API key request',
      'type': 'object',
      'properties': {
        'v': {
          'title': 'API version',
          'type': 'string',
        },
      },
      'required': ['v'],
    };
    return ajv.compile(adminGetAPIKeyRequestSchema);
  },

  getValidateAdminGetAPIKeyRes: function () {
    const adminGetAPIKeyResponseSchema = {
      '$schema': 'http://json-schema.org/draft-07/schema#',
      '$id': 'response/admin_get_api_key',
      'title': 'Admin get API key response',
      'type': 'object',
      'properties': {
        'api_key': {
          'type': ['string', 'null'],
          'title': 'API key',
        },
      },
      'required': ['api_key'],
    };
    return ajv.compile(adminGetAPIKeyResponseSchema);
  },
};
