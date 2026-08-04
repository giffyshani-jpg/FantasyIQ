import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, Router as WouterRouter } from 'wouter';

import Home from './pages/home';
import BasketballPage from './pages/basketball';
import CricketSchedule from './pages/cricket-schedule';
import FootballPage from './pages/football';
import FootballMatchDetails from './pages/football-match-details';
import FootballOptimizer from './pages/football-optimizer';
import LeagueGames from './pages/league-games';
import BoxScore from './pages/box-score';
import FantasyOptimizer from './pages/fantasy-optimizer';
import PlayByPlay from './pages/play-by-play';
import PlayerComparison from './pages/player-comparison';
import PlayerDetail from './pages/player-detail';
import CricketBoxScore from './pages/cricket-box-score';
import CricketOptimizer from './pages/cricket-optimizer';
import BasketballAnalysis from './pages/basketball-analysis';
import SmartScreenshotOptimizer from './pages/smart-screenshot-optimizer';
import { MatchFavoritesProvider } from './hooks/use-match-favorites';
import { RecentMatchesProvider } from './hooks/use-recent-matches';

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />

      {/* ── Sport hub pages ──────────────────────────────────────────────── */}
      <Route path="/basketball" component={BasketballPage} />
      <Route path="/cricket" component={CricketSchedule} />
      <Route path="/football" component={FootballPage} />
      <Route path="/smart-screenshot-optimizer" component={SmartScreenshotOptimizer} />
      <Route path="/football/:leagueId/game/:id/optimizer" component={FootballOptimizer} />
      <Route path="/football/:leagueId/game/:id" component={FootballMatchDetails} />
      <Route path="/:league/game/:id/analysis" component={BasketballAnalysis} />

      {/* ── Cricket routes ────────────────────────────────────────────────
          These MUST appear before the generic /:league routes so that
          /cricket/:competition/game/:id is not mis-matched as
          /:league/game/:id with league="cricket". */}
      <Route path="/cricket/:competition/game/:id/optimizer" component={CricketOptimizer} />
      <Route path="/cricket/:competition/game/:id" component={CricketBoxScore} />
      {/* NOTE: /cricket/:competition (competition-list page) intentionally omitted —
          LeagueGames expects a "league" param but this route provides "competition",
          causing a broken render. Unknown /cricket/* paths fall to NotFound. */}

      {/* ── Basketball routes ─────────────────────────────────────────── */}
      <Route path="/:league/game/:id/optimizer" component={FantasyOptimizer} />
      <Route path="/:league/game/:id/plays" component={PlayByPlay} />
      <Route path="/:league/game/:id/compare" component={PlayerComparison} />
      <Route path="/:league/player/:playerId" component={PlayerDetail} />
      <Route path="/:league/game/:id" component={BoxScore} />
      <Route path="/:league" component={LeagueGames} />

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <MatchFavoritesProvider>
      <RecentMatchesProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </RecentMatchesProvider>
      </MatchFavoritesProvider>
    </QueryClientProvider>
  );
}

export default App;
