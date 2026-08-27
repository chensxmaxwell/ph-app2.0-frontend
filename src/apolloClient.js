import { ApolloClient, InMemoryCache, createHttpLink } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { SchemaLink } from '@apollo/client/link/schema';
import { makeExecutableSchema } from '@graphql-tools/schema';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { resolvers } from './backend/resolvers';
import { typeDefs } from './backend/schema';

const readBackendUrl = () => {
  try {
    const env = require('@env');
    return String(env?.BACKEND_URL || '').trim();
  } catch (_error) {
    return '';
  }
};

const remoteGraphqlUri = () => {
  const backend = readBackendUrl().replace(/\/$/, '');
  if (!backend) {
    return null;
  }
  const lower = backend.toLowerCase();
  if (
    lower.includes('localhost') ||
    lower.includes('127.0.0.1') ||
    lower.includes('0.0.0.0') ||
    /^https?:\/\/\[::1\]/i.test(backend)
  ) {
    return null;
  }
  if (!/^https:\/\//i.test(backend)) {
    return null;
  }
  return backend.endsWith('/graphql') ? backend : `${backend}/graphql`;
};

const schema = makeExecutableSchema({
  typeDefs,
  resolvers,
});

const authLink = setContext(async (_, { headers }) => {
  const tokenStorage = await AsyncStorage.getItem('user');
  const token = tokenStorage ? JSON.parse(tokenStorage)?.token : null;

  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : '',
    },
  };
});

const remoteUri = remoteGraphqlUri();
const dataLink = remoteUri
  ? createHttpLink({ uri: remoteUri })
  : new SchemaLink({
      schema,
      context: async operation => {
        const headers = operation.getContext().headers || {};
        const raw = headers.authorization || headers.Authorization || '';
        const token = String(raw).replace(/^Bearer\s+/i, '');
        return { token };
      },
    });

const client = new ApolloClient({
  link: authLink.concat(dataLink),
  cache: new InMemoryCache(),
});

export default client;
