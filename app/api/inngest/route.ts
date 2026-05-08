import { serve } from 'inngest/next'
import { inngest } from '@/lib/inngest/client'
import {
  signupPaid,
  profileUpdated,
  takedownRequested,
} from '@/lib/inngest/functions'

// Inngest serve handler. Registers every function this agent owns. Agent 7
// will own its own functions (cron, lifecycle) and serve them — possibly
// mounted at this same route via a separate `serve()` import or merged here
// once their lane is wired in. Until then, only the publishing functions
// are registered.
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [signupPaid, profileUpdated, takedownRequested],
})
