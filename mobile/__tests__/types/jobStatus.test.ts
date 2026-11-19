import type { JobStatus } from '@/types/trail';

// Payloads mirror backend/app/api/routes.py get_status: FastAPI serializes
// unset optional fields as null, and unknown Celery states are lowercased.
describe('JobStatus matches the /status payload', () => {
  it('accepts null optional fields and other celery states', () => {
    const payloads: JobStatus[] = [
      { job_id: 'a', status: 'queued', progress: null, error: null, filename: null, file_size: null },
      { job_id: 'a', status: 'completed', progress: null, error: null, filename: 'gmapsupp.img', file_size: null },
      { job_id: 'a', status: 'started', progress: null, error: null, filename: null, file_size: null },
    ];
    expect(payloads).toHaveLength(3);
  });
});
