// Database helper functions
export class Database {
  static async query(sql: string, params: any[] = []) {
    const response = await fetch('/api/query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql, params }),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Database query failed with status ${response.status}`);
    }
    
    return response.json();
  }

  static async getUserById(id: string) {
    const result = await this.query('SELECT * FROM users WHERE id = ?', [id]);
    return Array.isArray(result) ? result[0] : null;
  }

  static async getUserByEmail(email: string) {
    const result = await this.query('SELECT * FROM users WHERE email = ?', [email]);
    return Array.isArray(result) ? result[0] : null;
  }

  static async createUser(email: string, passwordHash: string) {
    const result = await this.query(
      'INSERT INTO users (email, password_hash) VALUES (?, ?)',
      [email, passwordHash]
    );
    return result;
  }

  static async createSession(userId: string, sessionToken: string, expiresAt: Date) {
    await this.query(
      'INSERT INTO sessions (user_id, session_token, expires_at) VALUES (?, ?, ?)',
      [userId, sessionToken, expiresAt]
    );
  }

  static async getSessionByToken(token: string) {
    const result = await this.query(
      'SELECT s.*, u.email FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.session_token = ? AND s.expires_at > NOW()',
      [token]
    );
    return Array.isArray(result) ? result[0] : null;
  }

  static async deleteSession(token: string) {
    await this.query('DELETE FROM sessions WHERE session_token = ?', [token]);
  }

  static async getProfile(userId: string) {
    const result = await this.query('SELECT * FROM profiles WHERE user_id = ?', [userId]);
    return Array.isArray(result) ? result[0] : null;
  }

  static async createProfile(userId: string, displayName?: string, avatarUrl?: string) {
    await this.query(
      'INSERT INTO profiles (user_id, display_name, avatar_url) VALUES (?, ?, ?)',
      [userId, displayName || null, avatarUrl || null]
    );
  }

  static async updateProfile(userId: string, displayName?: string, avatarUrl?: string) {
    await this.query(
      'UPDATE profiles SET display_name = ?, avatar_url = ? WHERE user_id = ?',
      [displayName || null, avatarUrl || null, userId]
    );
  }

  static async getUserPackage(userId: string) {
    const sql = `
      SELECT p.* 
      FROM users u 
      JOIN packages p ON u.package_id = p.id 
      WHERE u.id = ?
    `;
    const result = await this.query(sql, [userId]);
    return Array.isArray(result) ? result[0] : null;
  }
}