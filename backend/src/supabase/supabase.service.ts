import { Injectable, Inject } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import supabaseConfig from '../config/supabase.config';

@Injectable()
export class SupabaseService {
  private supabase: SupabaseClient;

  constructor(
    @Inject(supabaseConfig.KEY)
    private config: ConfigType<typeof supabaseConfig>,
  ) {
    this.supabase = createClient(
      this.config.url,
      this.config.serviceRoleKey, // Using service role for backend operations
    );
  }

  getClient(): SupabaseClient {
    return this.supabase;
  }

  // Helper method to verify user token from frontend
  async verifyUserToken(token: string) {
    const {
      data: { user },
      error,
    } = await this.supabase.auth.getUser(token);

    if (error) {
      throw new Error(`Token verification failed: ${error.message}`);
    }

    return user;
  }
}
