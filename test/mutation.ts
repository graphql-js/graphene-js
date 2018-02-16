import { Mutation } from '../src/types/mutation';
import { ObjectType } from '../src/types/objecttype';
import { Str } from '../src/types/scalars';
import { Argument } from '../src/types/argument';
import { Schema } from '../src/types/schema';

describe('Mutation setup', () => {
  test('generate mutation', () => {
    class MyMutation extends Mutation {
      static description = 'description'
      static mutate(src, args, context, info) {
        return args;
      }
    }

    expect(MyMutation.name).toBe('MyMutation');
    expect(MyMutation.description).toBe('description');

    const field = MyMutation.toField();
    expect(field.type).toBe(MyMutation);
    const resolved = field.getResolver(null)(null, { foo: 'bar' }, null, null);
    expect(resolved).toMatchObject({ foo: 'bar' });
  });

  test('mutation throws error if no mutate', () => {
    class MyMutation extends Mutation { }
    expect(() => MyMutation.toField()).toThrow(Error);
  })

  test('mutation custom output type', () => {
    class User extends ObjectType {
      static fields = { name: new Str() }
    }

    class CreateUser extends Mutation {
      static args = { name: new Str() }

      static outputType = User

      static mutate(source, args, context, info) {
        return { name: args.name };
      }
    }

    const field = CreateUser.toField();
    expect(field.type).toBe(User);
    expect(field.args).toEqual({ name: new Argument(Str) });

    const resolved = field.getResolver(null)(null, { name: 'Peter' });
    expect(resolved).toEqual({ name: 'Peter' });
  });

  test('mutation execution', async () => {
    class CreateUser extends Mutation {
      static args = { name: new Str() }
      static fields = { name: new Str() }

      static mutate(source, args, context, info) {
        return { name: args.name };
      }
    }

    class Query extends ObjectType {
      static fields = { a: new Str() }
    }

    class MyMutation extends ObjectType {
      static fields = { createUser: CreateUser }
    }

    const schema = new Schema({ query: Query, mutation: MyMutation });

    const result = await schema.execute(`mutation mymutation {
      createUser(name:"Peter") {
          name
      }
    }`);

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({
      createUser: { name: 'Peter' },
    });

  });

  test('mutation no fields output', async () => {
    class CreateUser extends Mutation {
      static fields = { name: new Str() }

      static mutate(source) {
        return {};
      }
    }

    class Query extends ObjectType {
      static fields = { a: new Str() }
    }

    class MyMutation extends ObjectType {
      static fields = { createUser: CreateUser }
    }

    const schema = new Schema({ query: Query, mutation: MyMutation });
    const result = await schema.execute(`mutation mymutation {
      createUser {
          name
      }
    }`);
    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({
      createUser: { name: null },
    });
  })
})
