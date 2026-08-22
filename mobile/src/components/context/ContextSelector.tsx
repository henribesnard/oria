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
import { ContextBreadcrumb } from './ContextBreadcrumb';
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

  const handleBack = useCallback(() => {
    switch (level) {
      case 'allCountries':
        setLevel('league');
        break;
      case 'fixture':
        setSelectedLeague(null);
        setCtxState(EMPTY_CONTEXT_STATE);
        setLevel('league');
        break;
      case 'teamFromFixture':
        setSelectedFixture(null);
        setLevel('fixture');
        break;
      case 'player':
        setSelectedTeam(null);
        if (selectedFixture) {
          setLevel('teamFromFixture');
        } else {
          setLevel('fixture');
        }
        break;
    }
  }, [level, selectedFixture]);

  const handleApply = useCallback(() => {
    onApply(ctxState);
    reset();
    onClose();
  }, [ctxState, onApply, onClose, reset]);

  const buildCrumbs = () => {
    const crumbs: { label: string; onPress?: () => void }[] = [];
    crumbs.push({
      label: 'Ligue',
      onPress: level !== 'league' ? () => {
        setSelectedLeague(null);
        setSelectedFixture(null);
        setSelectedTeam(null);
        setCtxState(EMPTY_CONTEXT_STATE);
        setLevel('league');
      } : undefined,
    });
    if (level === 'allCountries') {
      crumbs.push({ label: 'Pays' });
    }
    if (selectedLeague && level !== 'league' && level !== 'allCountries') {
      crumbs.push({
        label: selectedLeague.name,
        onPress: level !== 'fixture' ? () => {
          setSelectedFixture(null);
          setSelectedTeam(null);
          setLevel('fixture');
        } : undefined,
      });
    }
    if (selectedFixture && (level === 'teamFromFixture' || level === 'player')) {
      crumbs.push({
        label: `${selectedFixture.home_team.slice(0, 3)} - ${selectedFixture.away_team.slice(0, 3)}`,
        onPress: level !== 'teamFromFixture' ? () => {
          setSelectedTeam(null);
          setLevel('teamFromFixture');
        } : undefined,
      });
    }
    if (selectedTeam && level === 'player') {
      crumbs.push({ label: selectedTeam.name });
    }
    return crumbs;
  };

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
          {/* Header */}
          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>Sélectionner un contexte</Text>
            <Pressable onPress={handleClose} hitSlop={12}>
              <Text style={styles.closeBtn}>{'\u2715'}</Text>
            </Pressable>
          </View>

          {/* Breadcrumb */}
          <ContextBreadcrumb
            crumbs={buildCrumbs()}
            onBack={level !== 'league' ? handleBack : undefined}
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
    maxHeight: '85%',
    minHeight: '55%',
  },
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 4,
  },
  panelTitle: {
    fontFamily: fonts.sansBold,
    fontSize: 16,
    color: colors.text,
  },
  closeBtn: {
    fontSize: 16,
    color: colors.textMuted,
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
