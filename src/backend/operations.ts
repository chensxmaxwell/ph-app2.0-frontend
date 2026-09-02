import { gql } from "@apollo/client";

export const CHAT_THREADS = gql`
  query ChatThreads {
    chatThreads {
      id
      name
      kind
      email
      preview
      lastActivityAt
      pinned
      listen
      synced
      request
      gender
      birthday
      description
      personality
      messages {
        id
        from
        text
        sentAt
        voice
        edited
        synced
      }
    }
  }
`;

export const UPSERT_CHAT_THREAD = gql`
  mutation UpsertChatThread($input: ChatThreadInput!) {
    upsertChatThread(input: $input) {
      id
      name
      kind
      preview
      lastActivityAt
      messages {
        id
        from
        text
        sentAt
        voice
        edited
        synced
      }
    }
  }
`;

export const POST_CHAT_MESSAGE = gql`
  mutation PostChatMessage($threadId: ID!, $message: ChatBubbleInput!) {
    postChatMessage(threadId: $threadId, message: $message) {
      id
      preview
      lastActivityAt
      messages {
        id
        from
        text
        sentAt
        voice
        edited
        synced
      }
    }
  }
`;

export const DELETE_CHAT_THREAD = gql`
  mutation DeleteChatThread($id: ID!) {
    deleteChatThread(id: $id)
  }
`;

export const COMPANIONS = gql`
  query Companions {
    companions {
      id
      userId
      name
      gender
      birthday
      personalities
      story
      passionateTender
      dominantSubmissive
      experimentalVanilla
      payload
    }
  }
`;

export const UPSERT_COMPANION = gql`
  mutation UpsertCompanion($input: CompanionInput!) {
    upsertCompanion(input: $input) {
      id
      userId
      name
      payload
    }
  }
`;

export const SETTINGS_RECORDS = gql`
  query SettingsRecords($kind: String) {
    records(kind: $kind) {
      id
      kind
      payload
    }
  }
`;

export const PUT_RECORD = gql`
  mutation PutRecord($kind: String!, $id: ID, $payload: String) {
    putRecord(kind: $kind, id: $id, payload: $payload) {
      id
      kind
      payload
    }
  }
`;
