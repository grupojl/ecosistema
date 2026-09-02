import { router, authProcedure } from '../trpc';
import type { AffiliatesService } from '../../affiliate/affiliate.service';

export function createAffiliatesRouter(affiliatesService: AffiliatesService) {
  return router({

    me: authProcedure
      .query(({ ctx }) =>
        affiliatesService.getMyProfile(ctx.uid!),
      ),

    myReferrals: authProcedure
      .query(({ ctx }) =>
        affiliatesService.getMyReferrals(ctx.uid!),
      ),
  });
}

export type AffiliatesRouter = ReturnType<typeof createAffiliatesRouter>;
