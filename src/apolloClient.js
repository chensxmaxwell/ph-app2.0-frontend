import { ApolloClient, InMemoryCache, createHttpLink } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import AsyncStorage from '@react-native-async-storage/async-storage';

const httpLink = createHttpLink({
  // used for testing on ios simulator
  // uri: 'http://localhost:4000/graphql',
  // used for cloud connection
  uri: 'https://o31edlh788.execute-api.us-east-1.amazonaws.com/',

  // used for testing on real ios device, adapt to your own ip address
  // uri: 'http://192.168.1.227:4000/graphql',
});

const authLink = setContext(async (_, { headers }) => {
  // Get the authentication token from storage if it exists
  const tokenStorage = await AsyncStorage.getItem('user');
  const token = tokenStorage ? JSON.parse(tokenStorage)?.token : null;

  // Return the headers to the context so httpLink can read them
  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : '',
    },
  };
});

const client = new ApolloClient({
  link: authLink.concat(httpLink),
  cache: new InMemoryCache(),
});

export default client;
