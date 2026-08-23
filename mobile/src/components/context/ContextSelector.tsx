import { useState, useCallback } from 'react';
import { View, Text, Pressable, Modal, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { League, Team, Player, Fixture } from '@/src/api/catalog';
import {
  type ContextState,
  EMPTY_CONTEXT_STATE,
  selectLeague,
  selectFixture,
  selectTeam,
  selectPlayer,
} from '@/src/lib/contextRules';
import { ContextBreadcrumb, type Crumb } from './ContextBreadcrumb';
import { LeagueSelector } from './LeagueSelector';
import { AllCountriesView } from './AllCountriesView';
import { FixtureTeamSelector } from './FixtureTeamSelector';
import { TeamFromFixtureSelector } from './TeamFromFixtureSelector';
import { PlayerSelector } from './PlayerSelector';
import { colors } from '@/src/theme/colors';
import { fonts } from '@/src/theme/typography';

type Level = 'league' | 'allCountries' | 'fixture' | 'teamFromFixture' | 'player';

interface Props {
  visible: boolean;
  onClose: () => void;
  onApply: (state: ContextState) => void;
}

export function ContextSelector({ visible, onClose, onApply }: Props) {
  const insets = useSafeAreaInsets();
  const [level, setLevel] = useState<Level>('league');
  const [selectedLeague, setSelectedLeague] = useState<League | null>(null);
  const [selectedFixture, setSelectedFixture] = useState<Fixture | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<{ id: number; name: string; logo?: string } | null>(null);
  const [countryFilter, setCountryFilter] = useState<string | null>(null);
  const [ctxState, setCtxState] = useState<ContextState>(EMPTY_CONTEXT_STATE);

  const reset = useCallback(() => {
    setLevel('league');
    setSelectedLeague(null);
    setSelectedFixture(null);
    setSelectedTeam(null);
    setCountryFilter(null);
    setCtxState(EMPTY_CONTEXT_STATE);
  }, []);

  // Reset on open
  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [onClose, reset]);

  const handleSelectLeague = useCallback((league: League) => {
    setSelectedLeague(league);
    const state = selectLeague(EMPTY_CONTEXT_STATE, {
      id: league.id, name: league.name, logo: league.logo, country: league.country,
    });
    setCtxState(state);
    setLevel('fixture');
  }, []);

  const handleSelectFixture = useCallback((fixture: Fixture) => {
    setSelectedFixture(fixture);
    const state = selectFixture(ctxState, {
      id: fixture.id, home: fixture.home_team, away: fixture.away_team,
      homeId: fixture.home_id, awayId: fixture.away_id,
      homeLogo: fixture.home_logo, awayLogo: fixture.away_logo,
      date: fixture.date, status: fixture.status, round: fixture.round,
    });
    setCtxState(state);
    setLevel('teamFromFixture');
  }, [ctxState]);

  const handleSelectTeamFromFixture = useCallback((teamId: number, teamName: string, teamLogo?: string) => {
    setSelectedTeam({ id: teamId, name: teamName, logo: teamLogo });
    const state = selectTeam(ctxState, { id: teamId, name: teamName, logo: teamLogo });
    setCtxState(state);
    setLevel('player');
  }, [ctxState]);

  const handleSelectTeamDirect = useCallback((team: Team) => {
    setSelectedTeam({ id: team.id, name: team.name, logo: team.logo });
    const state = selectTeam(ctxState, { id: team.id, name: team.name, logo: team.logo });
    setCtxState(state);
    setLevel('player');
  }, [ctxState]);

  const handleSelectPlayer = useCallback((player: Player) => {
    const state = selectPlayer(ctxState, {
      id: player.id, name: player.name, photo: player.photo, number: player.number,
    });
    setCtxState(state);
    // Auto-apply when player is selected
    onApply(state);
    reset();
    onClose();
  }, [ctxState, onApply, onClose, reset]);

  const handleSeeAllTeams = useCallback(() => {
    // Go back to fixture/team level to pick from team tab
    setLevel('fixture');
  }, []);

  const handleShowAllCountries = useCallback(() => {
    setLevel('allCountries');
  }, []);

  const handleSelectCountry = useCallback((country: string) => {
    setCountryFilter(country);
    setLevel('league');
  }, []);

  const handleApply = useCallback(() => {
    onApply(ctxState);
    reset();
    onClose();
  }, [ctxState, onApply, onClose, reset]);

  const handleStayAtTeam = useCallback(() => {
    // Apply context at team level (skip player selection)
    onApply(ctxState);
    reset();
    onClose();
  }, [ctxState, onApply, onClose, reset]);

  const buildCrumbs = (): Crumb[] => {
    const crumbs: Crumb[] = [];

    // League crumb (when a league is selected and we're past league level)
    if (selectedLeague && level !== 'league' && level !== 'allCountries') {
      const isLastCrumb = level === 'fixture';
      crumbs.push({
        label: selectedLeague.name,
        crest: selectedLeague.logo,
        onPress: !isLastCrumb ? () => {
          setSelectedFixture(null);
          setSelectedTeam(null);
          setLevel('fixture');
        } : undefined,
        onRemove: isLastCrumb ? () => {
          setSelectedLeague(null);
          setSelectedFixture(null);
          setSelectedTeam(null);
          setCtxState(EMPTY_CONTEXT_STATE);
          setLevel('league');
        } : undefined,
      });
    }

    // Fixture crumb
    if (selectedFixture && (level === 'teamFromFixture' || level === 'player')) {
      const isLastCrumb = level === 'teamFromFixture';
      crumbs.push({
        label: `${selectedFixture.home_team.slice(0, 3)}\u2013${selectedFixture.away_team.slice(0, 3)}`,
        crest: selectedFixture.home_logo,
        onPress: !isLastCrumb ? () => {
          setSelectedTeam(null);
          setLevel('teamFromFixture');
        } : undefined,
        onRemove: isLastCrumb ? () => {
          setSelectedFixture(null);
          setLevel('fixture');
        } : undefined,
      });
    }

    // Team crumb
    if (selectedTeam && level === 'player') {
      crumbs.push({
        label: selectedTeam.name,
        crest: selectedTeam.logo,
        onRemove: () => {
          setSelectedTeam(null);
          if (selectedFixture) {
            setLevel('teamFromFixture');
          } else {
            setLevel('fixture');
          }
        },
      });
    }

    return crumbs;
  };

  // Ghost label for the next expected level
  const nextLabel = (() => {
    if (level === 'league' || level === 'allCountries') return 'Compétition';
    if (level === 'fixture') return 'Affiche';
    if (level === 'teamFromFixture') return 'Équipe';
    if (level === 'player') return 'Joueur';
    return null;
  })();

  // Context summary label for the apply button
  const applyLabel = (() => {
    if (ctxState.labels.player) return `Cadrer sur ${ctxState.labels.player.name}`;
    if (ctxState.labels.team) return `Cadrer sur ${ctxState.labels.team.name}`;
    if (ctxState.labels.fixture) return `Cadrer sur ${ctxState.labels.fixture.home} - ${ctxState.labels.fixture.away}`;
    if (ctxState.labels.league) return `Cadrer sur ${ctxState.labels.league.name}`;
    return 'Sélectionner un contexte';
  })();

  const hasSelection = !!(ctxState.labels.league || ctxState.labels.team || ctxState.labels.fixture || ctxState.labels.player);

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={[styles.overlay, { paddingTop: insets.top }]}>
        <View style={[styles.panel, { paddingBottom: insets.bottom + 8 }]}>
          {/* Breadcrumb bar with integrated close */}
          <ContextBreadcrumb
            crumbs={buildCrumbs()}
            nextLabel={nextLabel}
            onClose={handleClose}
          />

          {/* Content */}
          <View style={styles.content}>
            {level === 'league' && (
              <LeagueSelector
                onSelectLeague={handleSelectLeague}
                onShowAllCountries={handleShowAllCountries}
              />
            )}
            {level === 'allCountries' && (
              <AllCountriesView onSelectCountry={handleSelectCountry} />
            )}
            {level === 'fixture' && selectedLeague && (
              <FixtureTeamSelector
                league={selectedLeague}
                onSelectFixture={handleSelectFixture}
                onSelectTeam={handleSelectTeamDirect}
              />
            )}
            {level === 'teamFromFixture' && selectedFixture && (
              <TeamFromFixtureSelector
                fixture={selectedFixture}
                onSelectTeam={handleSelectTeamFromFixture}
                onSeeAllTeams={handleSeeAllTeams}
              />
            )}
            {level === 'player' && selectedTeam && (
              <PlayerSelector
                teamId={selectedTeam.id}
                onSelectPlayer={handleSelectPlayer}
                onStayAtTeam={handleStayAtTeam}
              />
            )}
          </View>

          {/* Apply button */}
          <View style={styles.footer}>
            <Pressable
              style={[styles.applyBtn, !hasSelection && styles.applyBtnDisabled]}
              onPress={handleApply}
              disabled={!hasSelection}
            >
              <Text style={[styles.applyText, !hasSelection && styles.applyTextDisabled]}>
                {applyLabel}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  panel: {
    backgroundColor: colors.bgElevated,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 8,
    maxHeight: '85%',
    minHeight: '55%',
  },
  content: {
    flex: 1,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderLight,
  },
  applyBtn: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  applyBtnDisabled: {
    backgroundColor: colors.bgSurface,
  },
  applyText: {
    fontFamily: fonts.sansBold,
    fontSize: 15,
    color: colors.bg,
  },
  applyTextDisabled: {
    color: colors.textGhost,
  },
});
