import { ApolloClient, InMemoryCache } from '@apollo/client';
import { SchemaLink } from '@apollo/client/link/schema';
import { makeExecutableSchema } from '@graphql-tools/schema';

import { resolvers } from './backend/resolvers';
import { typeDefs } from './backend/schema';
import { getSessionUser } from './backend/session';

const schema = makeExecutableSchema({
  typeDefs,
  resolvers,
});

// On-device GraphQL only. Never HttpLink to localhost, AWS, or any remote.
const client = new ApolloClient({
  link: new SchemaLink({
    schema,
    context: () => ({
      token: getSessionUser()?.token || '',
    }),
  }),
  cache: new InMemoryCache(),
});

export default client;
