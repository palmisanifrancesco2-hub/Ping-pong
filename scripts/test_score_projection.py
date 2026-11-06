"""Numerical and scoring-law checks; all constructed outcomes here are synthetic."""
import unittest
import numpy as np
from scipy.special import roots_jacobi
from score_projection import set_kernels,project_point_probability,beta_quadrature,fit_point_model,projection_predict,projection_grid


class ProjectionTests(unittest.TestCase):
    def test_scoring_mass_exact_deuce_tail_and_cap_invariance(self):
        for p in [.05,.3,.5,.7,.95]:
            wt,lt,wd,ld=set_kernels(p)
            self.assertAlmostEqual(wt.sum()+lt.sum(),1,12)
            self.assertAlmostEqual(wd.sum()+ld.sum(),1,12)
            self.assertAlmostEqual(wt.sum(),wd.sum(),12)
            np.testing.assert_allclose(project_point_probability(p,86),project_point_probability(p,140),atol=1e-12)
        self.assertAlmostEqual(set_kernels(.5)[0].sum(),.5,12)

    def test_reversal_nested_lines_and_extreme_legal_scores(self):
        flip=[0,1,2,3,4,5,6,7,9,8,11,10,13,12]
        directional={0,1,8,9,10,11,12,13}
        for p in [.1,.35,.5,.65,.9]:
            a=project_point_probability(p);b=project_point_probability(1-p)
            for i,j in enumerate(flip):self.assertAlmostEqual(b[i],1-a[j] if i in directional else a[i],11)
            self.assertGreaterEqual(a[3],a[4]);self.assertGreaterEqual(a[5],a[6]);self.assertGreaterEqual(a[6],a[7])
            self.assertGreaterEqual(a[13],a[11]);self.assertGreaterEqual(a[11],a[10]);self.assertGreaterEqual(a[10],a[12])
        a=project_point_probability(1);self.assertEqual(a[0],1);self.assertEqual(a[3],0);self.assertEqual(a[5],0);self.assertEqual(a[12],1)
        self.assertAlmostEqual(project_point_probability(.5)[3],.75,12)
        self.assertAlmostEqual(project_point_probability(.5)[4],.375,12)
        with self.assertRaises(ValueError):project_point_probability(.5,30)

    def test_beta_nodes_match_reference_and_analytic_moments_even_at_extreme_shapes(self):
        for mean,k in [(.4,20),(.55,200),(.6,1000),(.999,5000),(.001,5000)]:
            p,w=beta_quadrature(mean,k,21)
            self.assertAlmostEqual(w.sum(),1,12)
            self.assertAlmostEqual(float(p@w),mean,11)
            self.assertAlmostEqual(float(((p-mean)**2)@w),mean*(1-mean)/(k+1),11)
        z,w=roots_jacobi(21,200*.45-1,200*.55-1)
        p,v=beta_quadrature(.55,200,21)
        np.testing.assert_allclose(p,(z+1)/2,atol=1e-12);np.testing.assert_allclose(v,w/w.sum(),atol=1e-12)

    def test_fitted_point_strength_has_a_real_data_relationship_and_symmetric_outputs(self):
        rows=[{'x':[(-1 if i%2 else 1),0,0,0,0,0,0,0], 'pointsFor':40 if i%2 else 60,'pointsAgainst':60 if i%2 else 40} for i in range(80)]
        for kind in ['rally-iid-logit','rally-beta-binomial']:
            fit=fit_point_model(rows,kind)
            self.assertTrue(fit['success']);self.assertGreater(fit['weights'][0],0)
            if fit['kappa'] is not None:self.assertTrue(20<=fit['kappa']<=5000.00001)
        with self.assertRaises(ValueError):fit_point_model([],'rally-iid-logit')

    def test_uncertainty_mixture_keeps_all_market_marginals_coherent(self):
        grid,table=projection_grid(512)
        model={'weights':[0]*8,'kappa':200}
        rows=[{'x':[0]*8}]
        a=projection_predict(model,rows,grid,table,nodes=21)[0]
        self.assertEqual(len(a),14);self.assertTrue(np.all((a>=0)&(a<=1)))
        self.assertAlmostEqual(a[0],.5,11);self.assertAlmostEqual(a[1],.5,11)
        self.assertLess(a[3],.75);self.assertLess(a[4],.375)
        self.assertGreaterEqual(a[5],a[6]);self.assertGreaterEqual(a[6],a[7])
        self.assertGreaterEqual(a[13],a[11]);self.assertGreaterEqual(a[11],a[10]);self.assertGreaterEqual(a[10],a[12])


if __name__=='__main__':unittest.main()
