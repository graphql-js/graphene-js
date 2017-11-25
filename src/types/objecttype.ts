import {
  GraphQLObjectType,
  defaultFieldResolver,
  GraphQLResolveInfo,
  GraphQLFieldConfig,
  GraphQLInterfaceType,
  GraphQLObjectTypeConfig
} from 'graphql';
import { UnmountedFieldMap, MountedFieldMap, mountFields } from './field';
import { Interface } from './interface';
import { GraphQLClassType, getGraphQLType } from './base';

export type Input = { [key: string]: Input } | string | boolean | number | null;
export type ResolverArguments = { [key: string]: Input };

export type ResolverFunction<T, R = any, A = ResolverArguments, C = any> = (
  root?: T,
  args?: A,
  context?: C,
  info?: GraphQLResolveInfo
) => R;

export class GrapheneObjectType extends GraphQLObjectType {
  grapheneType: typeof ObjectType;
  constructor(
    grapheneType: typeof ObjectType,
    config: GraphQLObjectTypeConfig<any, any>
  ) {
    super(config);
    this.grapheneType = grapheneType;
  }
}

export class ObjectType extends GraphQLClassType {
  static gql: GrapheneObjectType;
  static _fields: any;
  private static _interfaces: typeof Interface[];
  static set interfaces(value: typeof Interface[]) {
    this._interfaces = value;
  }
  static get interfaces(): typeof Interface[] {
    return this._interfaces || [];
  }
  static get fields(): UnmountedFieldMap {
    var interfaceFields = {};
    var interfaces = this.interfaces;
    for (let _interfaceIndex in interfaces) {
      let _interface: typeof Interface = interfaces[_interfaceIndex];
      interfaceFields = {
        ...interfaceFields,
        ..._interface.fields
      };
    }
    return {
      ...interfaceFields,
      ...this._fields
    };
  }

  static set fields(fields: UnmountedFieldMap) {
    this._fields = fields;
  }

  private static getMountedFields(): MountedFieldMap {
    return mountFields(this.fields);
  }
  static constructType(): GrapheneObjectType {
    return new GrapheneObjectType(this, {
      name: this.typeName,
      description: this.description,
      interfaces: this.interfaces.map(
        _interface => <GraphQLInterfaceType>getGraphQLType(_interface)
      ),
      fields: this.getGraphQLFields.bind(this)
    });
  }

  static getResolver<T = any>(fieldName: string): ResolverFunction<T> {
    var mountedFields = this.getMountedFields();
    const field = mountedFields[fieldName];
    if (!field) {
      throw new Error(
        `Can't get the resolver of a a field that is not in the ObjectType. Received: ${fieldName}.`
      );
    }

    var parentResolver = <ResolverFunction<T> | undefined>(this.resolvers[
      fieldName
    ] || this.prototype[fieldName]);
    if (!parentResolver) {
      var interfaces = this.interfaces;
      for (let _interface of interfaces) {
        let interfaceResolver = _interface.getResolver(fieldName);
        if (interfaceResolver !== undefined) {
          parentResolver = interfaceResolver;
          break;
        }
      }
    }
    if (parentResolver) {
      return field.getResolver(parentResolver);
    }
    return field.getResolver(<ResolverFunction<T>>defaultFieldResolver);
  }

  static resolvers: {
    [key: string]: ResolverFunction<any>;
  } = {};

  protected static getGraphQLFields() {
    var mountedFields: MountedFieldMap = this.getMountedFields();
    var graphqlFields: {
      [key: string]: GraphQLFieldConfig<any, any>;
    } = {};
    for (let fieldName in mountedFields) {
      graphqlFields[fieldName] = {
        ...mountedFields[fieldName].gql,
        resolve: this.getResolver(fieldName)
      };
    }
    return graphqlFields;
  }
  [key: string]: ResolverFunction<any>;
}
