import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/experiments
 * List all experiments
 */
export async function GET(req: NextRequest) {
  try {
    const { requireAuthWithOrg } = await import('@/lib/supabase/auth-helpers');
    const { getExperiments, getExperimentResults } = await import('@/lib/experiments/ab-testing');

    const { organizationId } = await requireAuthWithOrg();

    const { searchParams } = new URL(req.url);
    const experimentId = searchParams.get('id');

    if (experimentId) {
      const results = await getExperimentResults(experimentId, organizationId);
      if (!results) {
        return NextResponse.json({ error: 'Experiment not found' }, { status: 404 });
      }
      return NextResponse.json(results);
    }

    const experiments = await getExperiments(organizationId);
    return NextResponse.json({ experiments });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Experiments error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch experiments' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/experiments
 * Create a new experiment
 */
export async function POST(req: NextRequest) {
  try {
    const { requireAuthWithOrg } = await import('@/lib/supabase/auth-helpers');
    const { createExperiment } = await import('@/lib/experiments/ab-testing');

    const { organizationId } = await requireAuthWithOrg();

    const body = await req.json();
    
    if (!body.name || !body.hypothesis || !body.targetPlanId || !body.variants) {
      return NextResponse.json(
        { error: 'Missing required fields: name, hypothesis, targetPlanId, variants' },
        { status: 400 }
      );
    }

    const experiment = await createExperiment(organizationId, body);
    return NextResponse.json(experiment);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Create experiment error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create experiment' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/experiments
 * Update experiment status (start, pause, resume, end, cancel)
 */
export async function PATCH(req: NextRequest) {
  try {
    const { requireAuthWithOrg } = await import('@/lib/supabase/auth-helpers');
    const { 
      startExperiment, 
      pauseExperiment, 
      resumeExperiment, 
      endExperiment, 
      cancelExperiment 
    } = await import('@/lib/experiments/ab-testing');

    const { organizationId } = await requireAuthWithOrg();

    const body = await req.json();
    const { experimentId, action } = body;

    if (!experimentId || !action) {
      return NextResponse.json(
        { error: 'experimentId and action are required' },
        { status: 400 }
      );
    }

    let result;
    switch (action) {
      case 'start':
        result = await startExperiment(experimentId, organizationId);
        break;
      case 'pause':
        result = await pauseExperiment(experimentId, organizationId);
        break;
      case 'resume':
        result = await resumeExperiment(experimentId, organizationId);
        break;
      case 'end':
        result = await endExperiment(experimentId, organizationId);
        break;
      case 'cancel':
        result = await cancelExperiment(experimentId, organizationId);
        break;
      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: start, pause, resume, end, cancel' },
          { status: 400 }
        );
    }

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Update experiment error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update experiment' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/experiments
 * Delete a draft experiment
 */
export async function DELETE(req: NextRequest) {
  try {
    const { requireAuthWithOrg } = await import('@/lib/supabase/auth-helpers');
    const { deleteExperiment } = await import('@/lib/experiments/ab-testing');

    const { organizationId } = await requireAuthWithOrg();

    const { searchParams } = new URL(req.url);
    const experimentId = searchParams.get('id');

    if (!experimentId) {
      return NextResponse.json(
        { error: 'Experiment ID is required' },
        { status: 400 }
      );
    }

    await deleteExperiment(experimentId, organizationId);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Delete experiment error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete experiment' },
      { status: 500 }
    );
  }
}

