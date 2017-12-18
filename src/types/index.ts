/**
 * Copyright (c) 2017-present, Graphene.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import {
  GraphQLObjectType,
  isOutputType,
  isInputType,
  GraphQLArgumentConfig,
  graphql,
  printSchema,
  GraphQLFieldResolver,
  GraphQLResolveInfo,
  defaultFieldResolver,
  GraphQLInputType,
  GraphQLInterfaceType,
  GraphQLTypeResolver,
  GraphQLID,
  GraphQLInt,
  GraphQLEnumType,
  GraphQLEnumValueConfigMap,
  GraphQLList,
  GraphQLNonNull,
  GraphQLInputObjectType,
  GraphQLType,
  GraphQLScalarType,
  GraphQLSchema,
  ExecutionResult,
  GraphQLDirective,
  GraphQLNamedType
} from 'graphql';
import {
  getGraphQLType,
  setGraphQLType,
  setupNativeTypes,
  getDeprecationReason,
  getDescription,
  getFields,
  assertFields,
  UnmountedFieldMap,
  mountFields,
  getInputFields,
  assertInputFields,
  UnmountedInputFieldMap,
  mountInputFields
} from './reflection';

export {
  description,
  getDescription,
  deprecated,
  getDeprecationReason
} from './reflection';

export const ID: GraphQLScalarType = GraphQLID;
export const Int: GraphQLScalarType = GraphQLInt;
setupNativeTypes();

export const List = (ofType: any): GraphQLList<GraphQLType> => {
  return new GraphQLList(getGraphQLType(ofType));
};

export const NonNull = (ofType: any): GraphQLNonNull<GraphQLType> => {
  return new GraphQLNonNull(getGraphQLType(ofType));
};

export const Argument = (
  type: InputType,
  description?: string,
  defaultValue?: any
): ArgumentType => {
  return {
    type,
    description,
    defaultValue
  };
};

type ArgumentMap = {
  [key: string]: GraphQLArgumentConfig;
};

export type InputType =
  | GraphQLInputType
  | any
  | typeof String
  | typeof Number
  | typeof Boolean;

export type ArgumentType = {
  type: InputType;
  description?: string;
  defaultValue?: any;
};

export type FieldConfig = {
  args?: {
    [key: string]: ArgumentType | InputType;
  };
  description?: string;
  deprecationReason?: string;
};

export const Field = (type?: any, config: FieldConfig = {}) => (
  target: any,
  key: string
) => {
  var _class = target.constructor;
  var fields: UnmountedFieldMap = getFields(_class);
  if (key in fields) {
    throw new Error(`Field ${key} is already defined in ${_class}.`);
  }
  fields[key] = () => {
    var _type = getGraphQLType(type);
    if (!isOutputType(_type)) {
      throw new Error('Type is not output');
    }
    var argKey: string;
    var args = config.args || {};
    var fieldArgs: ArgumentMap = {};
    for (argKey in args) {
      var arg: ArgumentType | InputType = args[argKey];
      var extra: {};
      var argType: any;
      if (
        typeof (<ArgumentType>arg).type !== 'undefined' &&
        !isInputType(<GraphQLInputType>arg)
      ) {
        extra = {
          description: (<ArgumentType>arg).description
        };
        argType = (<ArgumentType>arg).type;
      } else {
        extra = {};
        argType = arg;
      }

      var newType = getGraphQLType(argType);
      if (!isInputType(newType)) {
        throw new Error(
          `Field argument ${argKey} expected to be Input type. Received: ${argType}.`
        );
      }
      fieldArgs[argKey] = {
        type: newType,
        ...extra
      };
    }
    var targetResolver = target[key];
    var resolver: GraphQLFieldResolver<any, any> = defaultFieldResolver;
    if (typeof targetResolver === 'function') {
      resolver = (
        root: any,
        args: { [argName: string]: any },
        context: any,
        info: GraphQLResolveInfo
      ) => {
        return targetResolver.call(root, args, context, info);
      };
    }
    return {
      args: fieldArgs,
      type: _type,
      description: getDescription(target, key),
      deprecationReason: getDeprecationReason(target, key),
      resolve: resolver
    };
  };
};

type InputFieldConfig = {
  defaultValue?: any;
  description?: string;
  deprecationReason?: string;
};

export const InputField = (type?: any, config: InputFieldConfig = {}) => (
  target: any,
  key: string
) => {
  var _class = target.constructor;
  var fields: UnmountedInputFieldMap = getInputFields(_class);
  if (key in fields) {
    throw new Error(`Field ${key} is already defined in ${_class}.`);
  }
  fields[key] = () => {
    var _type = getGraphQLType(type);
    if (!isInputType(_type)) {
      throw new Error('Type is not input');
    }
    var defaultValue: any = target[key];
    return {
      type: _type,
      description: config.description || getDescription(target, key),
      deprecationReason:
        config.deprecationReason || getDeprecationReason(target, key),
      defaultValue: config.defaultValue || defaultValue
    };
  };
};

export type ObjectTypeConfig = {
  name?: string;
  description?: string;
  interfaces?: any[];
};

// class MYI {
//   [key: string]: any;
// }

export const ObjectType = (opts: ObjectTypeConfig = {}) => <
  T extends { new (...args: any[]): any }
>(
  target: T
): T => {
  // save a reference to the original constructor
  var interfaces: GraphQLInterfaceType[] = (opts.interfaces || []).map(
    iface => {
      var ifaceType = getGraphQLType(iface);
      if (!(ifaceType instanceof GraphQLInterfaceType)) {
        throw new Error('Provided interface is not valid');
      }
      return ifaceType;
    }
  );

  var allInterfaceFields: UnmountedFieldMap = {};

  (opts.interfaces || []).forEach((_, index) => {
    var iface = (opts.interfaces || [])[index];
    var ifaceFields: UnmountedFieldMap = getFields(iface);
    allInterfaceFields = {
      ...allInterfaceFields,
      ...ifaceFields
    };
  });

  var fields: UnmountedFieldMap = {
    // First we introduce the fields from the interfaces that we inherit
    ...allInterfaceFields,
    // Then we retrieve the fields for the current type
    ...getFields(target)
  };

  assertFields(target, fields);

  setGraphQLType(
    target,
    new GraphQLObjectType({
      name: opts.name || target.name,
      description: opts.description || getDescription(target),
      interfaces: interfaces,
      fields: mountFields(fields)
    })
  );

  return target;
};

export type InterfaceTypeConfig = {
  name?: string;
  description?: string;
  resolveType?: (root?: any, context?: any, info?: GraphQLResolveInfo) => any;
};

export const InterfaceType = (opts: InterfaceTypeConfig = {}) => <
  T extends { new (...args: any[]): any }
>(
  target: T
): T => {
  var fields: UnmountedFieldMap = getFields(target);
  assertFields(target, fields);

  var resolveType: GraphQLTypeResolver<any, any> = (
    root?: any,
    context?: any,
    info?: GraphQLResolveInfo
  ): string | GraphQLObjectType | Promise<string | GraphQLObjectType> => {
    if (opts.resolveType) {
      root = opts.resolveType(root, context, info);
    }
    return <GraphQLObjectType>getGraphQLType(root);
  };

  setGraphQLType(
    target,
    new GraphQLInterfaceType({
      name: opts.name || target.name,
      description: opts.description || getDescription(target),
      resolveType: resolveType,
      fields: mountFields(fields)
    })
  );

  // var MYO = class extends target {
  //   [P in keyof target]?: target[P]
  // };
  return target;
  // return class extends target implements MYI {
  //   ra: boolean = true;
  // };

  // return new constructor (will override original)
  // return target;
};

export type InputObjectTypeConfig = {
  name?: string;
  description?: string;
};

export const InputObjectType = (opts: InputObjectTypeConfig = {}) => <
  T extends { new (...args: any[]): any }
>(
  target: T
): T => {
  var fields: UnmountedInputFieldMap = getInputFields(target);
  assertInputFields(target, fields);

  setGraphQLType(
    target,
    new GraphQLInputObjectType({
      name: opts.name || target.name,
      description: opts.description || getDescription(target),
      fields: mountInputFields(fields)
    })
  );

  return target;
};

class BaseClass {}

const BaseClassProperties = Object.getOwnPropertyNames(BaseClass);

// We remove the properties automatically included in the BaseClass
// Such as .length, .name and .prototype
const getStaticProperties = (_class: Object) => {
  return Object.getOwnPropertyNames(_class).filter(
    name => BaseClassProperties.indexOf(name) === -1
  );
};

type EnumConfig = {
  name?: string;
  description?: string;
};

export const EnumType = (opts: EnumConfig = {}) => <
  T extends { new (...args: any[]): {}; [key: string]: any }
>(
  target: T
): T => {
  var values: GraphQLEnumValueConfigMap = {};
  getStaticProperties(target).forEach(name => {
    values[name] = {
      value: target[name],
      description: getDescription(target, name),
      deprecationReason: getDeprecationReason(target, name)
    };
  });
  setGraphQLType(
    target,
    new GraphQLEnumType({
      name: opts.name || target.name,
      description: opts.description || getDescription(target),
      values: values
    })
  );
  return target;
  // // return constructor;
  // return class extends constructor {};
};

type EnumValueConfig = {
  description?: string;
};

export const EnumValue = (config: EnumValueConfig = {}) => (
  target: any,
  key: string
) => {
  console.log('enumvalue', config, target, key);
};

export type SchemaConfig = {
  query?: any;
  mutation?: any;
  subscription?: any;
  directives?: GraphQLDirective[];
  types: any[];
};

type GraphQLSchemaConfig = {
  query: GraphQLObjectType;
  mutation?: GraphQLObjectType;
  subscription?: GraphQLObjectType;
  directives?: GraphQLDirective[];
  types?: GraphQLNamedType[];
};

export class Schema extends GraphQLSchema {
  constructor(config: SchemaConfig) {
    var schemaConfig: GraphQLSchemaConfig = {
      query: <GraphQLObjectType>getGraphQLType(config.query),
      directives: config.directives
    };
    if (config.mutation) {
      schemaConfig.mutation = <GraphQLObjectType>getGraphQLType(
        config.mutation
      );
    }
    if (config.subscription) {
      schemaConfig.subscription = <GraphQLObjectType>getGraphQLType(
        config.subscription
      );
    }
    if (config.types) {
      schemaConfig.types = config.types.map(
        type => <GraphQLObjectType>getGraphQLType(type)
      );
    }
    super(schemaConfig);
  }
  execute(query: string, ...args: any[]): Promise<ExecutionResult> {
    return graphql(this, query, ...args);
  }
  toString() {
    return printSchema(this);
  }
}
