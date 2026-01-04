import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { SupabaseService } from './supabase/supabase.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly supabaseService: SupabaseService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  getHealth(): { status: string; timestamp: string; service: string } {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'BudgetWise API',
    };
  }

  @Get('db-test')
  async testDatabaseConnection() {
    try {
      const supabase = this.supabaseService.getClient();

      // Test database connection by querying Supabase
      const { data, error } = await supabase
        .from('profiles')
        .select('count')
        .limit(1);

      if (error) {
        return {
          status: 'error',
          message: 'Database connection failed',
          error: error.message,
          hint: 'Make sure you have applied the schema.sql to your Supabase database',
        };
      }

      return {
        status: 'success',
        message: 'Database connection successful',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'error',
        message: 'Unexpected error',
        error: error.message,
      };
    }
  }
}
