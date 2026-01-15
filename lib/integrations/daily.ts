/**
 * Daily.co integration for creating video rooms
 * Reference: https://docs.daily.co/reference
 *
 * Daily Rooms API uses:
 * - POST /v1/rooms with body { name, privacy, properties }
 * - DELETE /v1/rooms/:name
 */

const DAILY_API_BASE = "https://api.daily.co/v1";

type DailyRoomPrivacy = "public" | "private";

// Daily calls these "properties" on the Rooms API
type DailyRoomProperties = {
  max_participants?: number;
  enable_chat?: boolean;
  enable_screenshare?: boolean;
  enable_recording?: boolean;
  enable_transcription?: boolean;
  start_video_off?: boolean;
  start_audio_off?: boolean;
  owner_only_broadcast?: boolean;
  enable_prejoin_ui?: boolean;
  enable_knocking?: boolean;
  enable_network_ui?: boolean;
  enable_people_ui?: boolean;
  enable_pip_ui?: boolean;
  exp?: number; // Unix timestamp for room expiration
};

type DailyRoom = {
  id: string;
  name: string;
  api_created: boolean;
  privacy: DailyRoomPrivacy;
  url: string;
  created_at: string;
  // Daily returns properties under `config` in some SDKs, but Rooms API is `properties`.
  // Keep it loose to avoid coupling too hard.
  config?: unknown;
  properties?: DailyRoomProperties;
};

/**
 * Get Daily.co API key from environment
 */
function getDailyApiKey(): string {
  const key = process.env.DAILY_API_KEY;
  if (!key) {
    throw new Error("DAILY_API_KEY environment variable is not set");
  }
  return key;
}

/**
 * Create a Daily.co room for a session
 * @param sessionTitle - Title of the session (used as room name/topic)
 * @param config - Optional room configuration
 * @returns Daily room object with URL
 */
export async function createDailyRoom(
  sessionTitle: string,
  properties?: DailyRoomProperties & { privacy?: DailyRoomPrivacy }
): Promise<DailyRoom> {
  const apiKey = getDailyApiKey();

  // Generate a unique room name based on timestamp and random string
  const roomName = `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  const privacy: DailyRoomPrivacy = properties?.privacy || "private";

  // Default properties with reasonable defaults
  const roomProperties: DailyRoomProperties = {
    max_participants: 100,
    enable_chat: true,
    enable_screenshare: true,
    enable_recording: false,
    enable_transcription: false,
    start_video_off: false,
    start_audio_off: false,
    enable_prejoin_ui: true,
    enable_knocking: false,
    ...properties,
  };

  try {
    const response = await fetch(`${DAILY_API_BASE}/rooms`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: roomName,
        privacy,
        properties: roomProperties,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
      throw new Error(
        `Daily.co API error: ${response.status} - ${errorData.error || response.statusText}`
      );
    }

    const room: DailyRoom = await response.json();
    return room;
  } catch (error: any) {
    if (error.message.includes("DAILY_API_KEY")) {
      throw error;
    }
    throw new Error(`Failed to create Daily.co room: ${error.message}`);
  }
}

/**
 * Delete a Daily.co room
 * @param roomName - Name/ID of the room to delete
 */
export async function deleteDailyRoom(roomName: string): Promise<void> {
  const apiKey = getDailyApiKey();

  try {
    const response = await fetch(`${DAILY_API_BASE}/rooms/${roomName}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok && response.status !== 404) {
      // 404 is OK - room might already be deleted
      const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
      throw new Error(
        `Daily.co API error: ${response.status} - ${errorData.error || response.statusText}`
      );
    }
  } catch (error: any) {
    throw new Error(`Failed to delete Daily.co room: ${error.message}`);
  }
}

type DailyMeetingTokenRequest = {
  room_name: string;
  user_name?: string;
  is_owner?: boolean;
  exp?: number; // unix seconds
};

type DailyMeetingTokenResponse = {
  token: string;
};

/**
 * Create a meeting token for a private room.
 * Participants must join using: `${roomUrl}?t=${token}`
 * Docs: https://docs.daily.co/reference (Meeting tokens)
 */
export async function createDailyMeetingToken(
  req: DailyMeetingTokenRequest
): Promise<string> {
  const apiKey = getDailyApiKey();

  const response = await fetch(`${DAILY_API_BASE}/meeting-tokens`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      // Daily expects token properties under `properties`
      properties: req,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(
      `Daily.co API error: ${response.status} - ${errorData.error || response.statusText}`
    );
  }

  const payload = (await response.json()) as DailyMeetingTokenResponse;
  if (!payload?.token) throw new Error("Daily.co token response missing token");
  return payload.token;
}

