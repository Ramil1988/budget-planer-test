// Netlify Function: Dismissed Suggestions
// Manages user-dismissed budget suggestions for persistence across sessions

import { createClient } from '@supabase/supabase-js';

// Create Supabase client with service role key for bypassing RLS
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// CORS headers
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Content-Type': 'application/json',
};

/**
 * Authenticate user from JWT token
 */
async function authenticateUser(event) {
  const token = event.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return { error: 'Missing authorization token', status: 401 };
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return { error: 'Unauthorized', status: 401 };
  }

  return { user };
}

/**
 * GET: Retrieve dismissed suggestions for a month
 * Query params: month (required, format: YYYY-MM)
 */
async function handleGet(event, userId) {
  const queryParams = event.queryStringParameters || {};
  const month = queryParams.month;

  if (!month) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Month parameter is required (format: YYYY-MM)' }),
    };
  }

  const { data, error } = await supabase
    .from('dismissed_suggestions')
    .select('category_id, suggestion_type, recommendation_type')
    .eq('user_id', userId)
    .eq('month', month);

  if (error) {
    console.error('Error fetching dismissed suggestions:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to fetch dismissed suggestions' }),
    };
  }

  // Convert to a set of IDs for easy lookup in frontend
  // Format: "categoryId" for recommendations, "savings-categoryId" for savings
  const dismissedIds = data.map(d =>
    d.suggestion_type === 'savings' ? `savings-${d.category_id}` : d.category_id
  );

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      dismissed: dismissedIds,
      count: dismissedIds.length,
    }),
  };
}

/**
 * POST: Dismiss a suggestion
 * Body: { categoryId, suggestionType, recommendationType?, month }
 */
async function handlePost(event, userId) {
  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Invalid JSON body' }),
    };
  }

  const { categoryId, suggestionType, recommendationType, month } = body;

  if (!categoryId || !suggestionType || !month) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        error: 'Missing required fields: categoryId, suggestionType, month',
      }),
    };
  }

  if (!['recommendation', 'savings'].includes(suggestionType)) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        error: 'suggestionType must be "recommendation" or "savings"',
      }),
    };
  }

  // Upsert the dismissal (update if exists, insert if not)
  const { data, error } = await supabase
    .from('dismissed_suggestions')
    .upsert({
      user_id: userId,
      category_id: categoryId,
      suggestion_type: suggestionType,
      recommendation_type: recommendationType || null,
      month: month,
      dismissed_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id,category_id,suggestion_type,month',
    })
    .select();

  if (error) {
    console.error('Error dismissing suggestion:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to dismiss suggestion' }),
    };
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      dismissed: data[0],
    }),
  };
}

/**
 * DELETE: Undismiss a suggestion (remove from dismissed list)
 * Query params: categoryId, suggestionType, month
 */
async function handleDelete(event, userId) {
  const queryParams = event.queryStringParameters || {};
  const { categoryId, suggestionType, month } = queryParams;

  if (!categoryId || !suggestionType || !month) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        error: 'Missing required params: categoryId, suggestionType, month',
      }),
    };
  }

  const { error } = await supabase
    .from('dismissed_suggestions')
    .delete()
    .eq('user_id', userId)
    .eq('category_id', categoryId)
    .eq('suggestion_type', suggestionType)
    .eq('month', month);

  if (error) {
    console.error('Error undismissing suggestion:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to undismiss suggestion' }),
    };
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ success: true }),
  };
}

export async function handler(event) {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  try {
    // Authenticate user
    const authResult = await authenticateUser(event);
    if (authResult.error) {
      return {
        statusCode: authResult.status,
        headers,
        body: JSON.stringify({ error: authResult.error }),
      };
    }

    const userId = authResult.user.id;

    // Route to appropriate handler
    switch (event.httpMethod) {
      case 'GET':
        return handleGet(event, userId);
      case 'POST':
        return handlePost(event, userId);
      case 'DELETE':
        return handleDelete(event, userId);
      default:
        return {
          statusCode: 405,
          headers,
          body: JSON.stringify({ error: 'Method not allowed' }),
        };
    }
  } catch (error) {
    console.error('Dismissed suggestions error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
}
