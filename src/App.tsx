import { useEffect, useMemo, useState, useRef } from 'react';
import './App.css';

type Team = { id: number; name: string };
type RawMatch = {
  id: number;
  date: string; // dd/MM/yyyy
  time: string; // HH:mm (24h)
  teams: { home: Team; away: Team };
};
type RawLeague = {
  metadata: { league: string; timezone?: string };
  matches: RawMatch[];
};

type LeagueKey = 'Premier League' | 'La Liga' | 'Bundesliga' | 'Serie A';
type Status = 'UPCOMING' | 'LIVE' | 'FINISHED';

type Match = RawMatch & {
  league: LeagueKey;
  kickoff: Date;
  status: Status;
};

const PUBLIC_FILES: Record<LeagueKey, string> = {
  'Premier League': '/premier_league.json',
  'La Liga': '/la_liga.json',
  Bundesliga: '/bundesliga.json',
  'Serie A': '/serie_a.json',
};

// Utility function to get league logo path
function getLeagueLogoPath(league: string): string {
  const leagueFolder = league.toLowerCase().replace(/\s+/g, '_');
  return `/league_logos/${leagueFolder}.png`;
}

// Utility function to get team logo path
function getTeamLogoPath(teamName: string, league: string): string {
  // Convert team name to filename format (lowercase, spaces and special chars to underscores)
  const filename = teamName
    .toLowerCase()
    .replace(/[&\-\.\(\)]/g, '_') // Replace special characters with underscore
    .replace(/\s+/g, '_') // Replace spaces with underscore
    .replace(/^_|_$/g, ''); // Remove leading/trailing underscores
  // Note: Keep multiple underscores as they might be part of the actual filename

  // Convert league name to folder format (lowercase, spaces to underscores)
  const leagueFolder = league.toLowerCase().replace(/\s+/g, '_');

  return `/team_logos/${leagueFolder}/${filename}.png`;
}

function parseWIBDate(dateStr: string, timeStr: string): Date {
  // date: dd/MM/yyyy, time: HH:mm
  const [d, m, y] = dateStr.split('/').map(Number);
  const [hh, mm] = timeStr.split(':').map(Number);
  // Build ISO string in UTC+7
  const iso = `${y.toString().padStart(4, '0')}-${m
    .toString()
    .padStart(2, '0')}-${d.toString().padStart(2, '0')}T${hh
    .toString()
    .padStart(2, '0')}:${mm.toString().padStart(2, '0')}:00+07:00`;
  return new Date(iso);
}

function calculateStatus(now: Date, kickoff: Date): Status {
  const matchDurationMs = 110 * 60 * 1000; // 120 minutes window (90 min + added time)
  if (now < kickoff) return 'UPCOMING';
  if (now >= kickoff && now < new Date(kickoff.getTime() + matchDurationMs)) {
    return 'LIVE';
  }
  return 'FINISHED';
}

function formatTimeWIB(date: Date): string {
  try {
    return new Intl.DateTimeFormat('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Jakarta',
    }).format(date);
  } catch {
    // Fallback
    const hh = date.getHours().toString().padStart(2, '0');
    const mm = date.getMinutes().toString().padStart(2, '0');
    return `${hh}:${mm}`;
  }
}

function formatDateIndonesian(date: Date): string {
  const months = [
    'Januari',
    'Februari',
    'Maret',
    'April',
    'Mei',
    'Juni',
    'Juli',
    'Agustus',
    'September',
    'Oktober',
    'November',
    'Desember',
  ];

  const day = date.getDate();
  const month = months[date.getMonth()];
  const year = date.getFullYear();

  return `${day} ${month} ${year}`;
}

function useAllMatches(): {
  matches: Match[];
  loading: boolean;
  error?: string;
} {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const now = new Date();
        const entries = await Promise.all(
          (Object.keys(PUBLIC_FILES) as LeagueKey[]).map(async (league) => {
            const res = await fetch(PUBLIC_FILES[league]);
            if (!res.ok) throw new Error(`Gagal mengambil data ${league}`);
            const json = (await res.json()) as RawLeague;
            const list: Match[] = json.matches.map((m) => {
              const kickoff = parseWIBDate(m.date, m.time);
              return {
                ...m,
                league,
                kickoff,
                status: calculateStatus(now, kickoff),
              };
            });
            return list;
          })
        );
        if (!cancelled) {
          setMatches(entries.flat());
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? 'Terjadi kesalahan');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    const t = setInterval(() => {
      // refresh status every minute
      setMatches((prev) => {
        const now = new Date();
        return prev.map((m) => ({
          ...m,
          status: calculateStatus(now, m.kickoff),
        }));
      });
    }, 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  return { matches, loading, error };
}

function LeagueLogo({ league }: { league: string }) {
  const logoPath = useMemo(() => getLeagueLogoPath(league), [league]);

  return <img src={logoPath} alt={`${league} logo`} className="league-logo" />;
}

function TeamBadge({ name, league }: { name: string; league: string }) {
  const [logoError, setLogoError] = useState(false);

  const initials = useMemo(() => {
    const words = name
      .replace(/&/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .filter(
        (w) =>
          !['FC', 'CF', 'AC', 'AS', 'UD', 'CD', 'SC', 'De', 'Of'].includes(w)
      );
    const letters = (words[0]?.[0] || '') + (words[1]?.[0] || '');
    return letters.toUpperCase();
  }, [name]);

  const logoPath = useMemo(() => getTeamLogoPath(name, league), [name, league]);

  const handleImageError = () => {
    setLogoError(true);
  };

  return (
    <div className="badge">
      {!logoError ? (
        <img
          src={logoPath}
          alt={`${name} logo`}
          onError={handleImageError}
          className="team-logo"
        />
      ) : (
        <span>{initials || name.slice(0, 2).toUpperCase()}</span>
      )}
    </div>
  );
}

function StatusPill({ status, time }: { status: Status; time: string }) {
  if (status === 'UPCOMING') {
    return (
      <span className="pill pill-upcoming">
        <span className="icon">🕒</span> {time}
      </span>
    );
  }
  if (status === 'LIVE') {
    return (
      <span className="pill pill-live">
        <span className="pulse" /> Live
      </span>
    );
  }
  return <span className="pill pill-finished">FT</span>;
}

function SearchableSelect({
  value,
  onChange,
  options,
  placeholder,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder: string;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options;
    return options.filter((option) =>
      option.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [options, searchQuery]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSearchQuery('');
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () =>
        document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleSelect = (option: string) => {
    onChange(option);
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <div className={`searchable-select ${className || ''}`} ref={dropdownRef}>
      <div className="select-trigger" onClick={() => setIsOpen(!isOpen)}>
        <span className="select-value">{value || placeholder}</span>
        <span className={`select-arrow ${isOpen ? 'open' : ''}`}>▼</span>
      </div>

      {isOpen && (
        <div className="select-dropdown">
          <div className="select-search">
            <input
              type="text"
              placeholder="Cari tim..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="select-search-input"
              autoFocus
            />
          </div>
          <div className="select-options">
            <div
              className={`select-option ${!value ? 'selected' : ''}`}
              onClick={() => handleSelect('')}
            >
              {placeholder}
            </div>
            {filteredOptions.map((option) => (
              <div
                key={option}
                className={`select-option ${
                  value === option ? 'selected' : ''
                }`}
                onClick={() => handleSelect(option)}
              >
                {option}
              </div>
            ))}
            {filteredOptions.length === 0 && searchQuery && (
              <div className="select-no-results">
                Tidak ada tim yang ditemukan
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Pagination({
  currentPage,
  totalPages,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  const getVisiblePages = () => {
    const pages = [];
    const showEllipsis = totalPages > 7;

    if (!showEllipsis) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 4) {
        for (let i = 1; i <= 5; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 3) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      }
    }

    return pages;
  };

  return (
    <div className="pagination">
      <button
        className="pagination-btn"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
      >
        ←
      </button>

      {getVisiblePages().map((page, index) => (
        <button
          key={index}
          className={`pagination-btn ${page === currentPage ? 'active' : ''} ${
            page === '...' ? 'ellipsis' : ''
          }`}
          onClick={() => typeof page === 'number' && onPageChange(page)}
          disabled={page === '...'}
        >
          {page}
        </button>
      ))}

      <button
        className="pagination-btn"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
      >
        →
      </button>
    </div>
  );
}

function MatchCard({ match }: { match: Match }) {
  const timeWIB = formatTimeWIB(match.kickoff);
  const dateIndonesian = formatDateIndonesian(match.kickoff);

  return (
    <div
      className={`card match ${match.status.toLowerCase()} league-${match.league
        .toLowerCase()
        .replace(/\s+/g, '-')}`}
    >
      <div className="card-header">
        <div className="match-date">📅 {dateIndonesian}</div>
      </div>
      <div className="divider" />
      <div className="teams">
        <div className="team">
          <TeamBadge name={match.teams.home.name} league={match.league} />
          <div className="team-name">{match.teams.home.name}</div>
        </div>
        <div className="vs">
          <div className="vs-text">VS</div>
          <StatusPill status={match.status} time={timeWIB} />
        </div>
        <div className="team right">
          <TeamBadge name={match.teams.away.name} league={match.league} />
          <div className="team-name">{match.teams.away.name}</div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const { matches, loading, error } = useAllMatches();
  const [selectedLeagues, setSelectedLeagues] = useState<
    Set<LeagueKey | 'ALL'>
  >(new Set(['ALL']));
  const [selectedTeam, setSelectedTeam] = useState<string>('Real Madrid');
  const [leaguePages, setLeaguePages] = useState<Record<string, number>>({});
  const [leagueStatusFilters, setLeagueStatusFilters] = useState<
    Record<string, 'ALL' | 'LIVE' | 'FINISHED'>
  >({});
  const [leagueSearchQueries, setLeagueSearchQueries] = useState<
    Record<string, string>
  >({});
  const [showTeamHighlight, setShowTeamHighlight] = useState<boolean>(false);

  const MATCHES_PER_PAGE = 6;

  const filtered = useMemo(() => {
    return matches
      .filter((m) => {
        if (selectedLeagues.has('ALL')) return true;
        return selectedLeagues.has(m.league);
      })
      .sort((a, b) => {
        // Only move finished matches to bottom
        if (a.status === 'FINISHED' && b.status !== 'FINISHED') return 1;
        if (b.status === 'FINISHED' && a.status !== 'FINISHED') return -1;
        return a.kickoff.getTime() - b.kickoff.getTime();
      });
  }, [matches, selectedLeagues]);

  // Get all unique teams for dropdown
  const allTeams = useMemo(() => {
    const teams = new Set<string>();
    matches.forEach((match) => {
      teams.add(match.teams.home.name);
      teams.add(match.teams.away.name);
    });
    return Array.from(teams).sort();
  }, [matches]);

  // Get team's upcoming matches
  const teamMatches = useMemo(() => {
    if (!selectedTeam) return [];
    return matches
      .filter(
        (match) =>
          match.teams.home.name === selectedTeam ||
          match.teams.away.name === selectedTeam
      )
      .sort((a, b) => {
        // Only move finished matches to bottom
        if (a.status === 'FINISHED' && b.status !== 'FINISHED') return 1;
        if (b.status === 'FINISHED' && a.status !== 'FINISHED') return -1;
        return a.kickoff.getTime() - b.kickoff.getTime();
      })
      .slice(0, 4);
  }, [matches, selectedTeam]);

  // Group matches by league
  const groupedMatches = useMemo(() => {
    const groups: Record<LeagueKey, Match[]> = {
      'Premier League': [],
      'La Liga': [],
      Bundesliga: [],
      'Serie A': [],
    };

    filtered.forEach((match) => {
      groups[match.league].push(match);
    });

    // Return leagues that have matches (before status filtering)
    return Object.entries(groups)
      .filter(([_, matches]) => matches.length > 0)
      .map(([leagueName, matches]) => {
        return [leagueName, matches] as [string, Match[]];
      });
  }, [filtered]);

  // Apply status and search filtering to individual league matches
  const getFilteredLeagueMatches = (leagueName: string, matches: Match[]) => {
    const statusFilter = leagueStatusFilters[leagueName] || 'ALL';
    const searchQuery = (leagueSearchQueries[leagueName] || '')
      .trim()
      .toLowerCase();

    return matches.filter((match) => {
      // Status filter
      if (statusFilter !== 'ALL') {
        if (statusFilter === 'LIVE' && match.status !== 'LIVE') return false;
        if (statusFilter === 'FINISHED' && match.status !== 'FINISHED')
          return false;
      }

      // Search filter
      if (searchQuery) {
        const homeMatch = match.teams.home.name
          .toLowerCase()
          .includes(searchQuery);
        const awayMatch = match.teams.away.name
          .toLowerCase()
          .includes(searchQuery);
        if (!homeMatch && !awayMatch) return false;
      }

      return true;
    });
  };

  // Reset pagination when filters change
  useEffect(() => {
    setLeaguePages({});
  }, [selectedLeagues, leagueStatusFilters, leagueSearchQueries]);

  return (
    <div className="page">
      <header className="topbar">
        <div className="header-content">
          <h1>⚽ Jadwal Bola (Liga)</h1>
        </div>
      </header>

      {/* League Filter Section */}
      <div className="sticky-section">
        <div className="league-filters">
          <button
            className={`league-filter ${
              selectedLeagues.has('ALL') ? 'active' : ''
            }`}
            onClick={() => setSelectedLeagues(new Set(['ALL']))}
          >
            🌍 Semua Liga
          </button>
          <button
            className={`league-filter ${
              selectedLeagues.has('Premier League') ? 'active' : ''
            }`}
            onClick={() => {
              if (selectedLeagues.has('Premier League')) {
                const newSet = new Set(selectedLeagues);
                newSet.delete('Premier League');
                if (newSet.size === 0) newSet.add('ALL');
                setSelectedLeagues(newSet);
              } else {
                const newSet = new Set(selectedLeagues);
                newSet.delete('ALL');
                newSet.add('Premier League');
                setSelectedLeagues(newSet);
              }
            }}
          >
            <LeagueLogo league="Premier League" /> Premier League
          </button>
          <button
            className={`league-filter ${
              selectedLeagues.has('La Liga') ? 'active' : ''
            }`}
            onClick={() => {
              if (selectedLeagues.has('La Liga')) {
                const newSet = new Set(selectedLeagues);
                newSet.delete('La Liga');
                if (newSet.size === 0) newSet.add('ALL');
                setSelectedLeagues(newSet);
              } else {
                const newSet = new Set(selectedLeagues);
                newSet.delete('ALL');
                newSet.add('La Liga');
                setSelectedLeagues(newSet);
              }
            }}
          >
            <LeagueLogo league="La Liga" /> La Liga
          </button>
          <button
            className={`league-filter ${
              selectedLeagues.has('Bundesliga') ? 'active' : ''
            }`}
            onClick={() => {
              if (selectedLeagues.has('Bundesliga')) {
                const newSet = new Set(selectedLeagues);
                newSet.delete('Bundesliga');
                if (newSet.size === 0) newSet.add('ALL');
                setSelectedLeagues(newSet);
              } else {
                const newSet = new Set(selectedLeagues);
                newSet.delete('ALL');
                newSet.add('Bundesliga');
                setSelectedLeagues(newSet);
              }
            }}
          >
            <LeagueLogo league="Bundesliga" /> Bundesliga
          </button>
          <button
            className={`league-filter ${
              selectedLeagues.has('Serie A') ? 'active' : ''
            }`}
            onClick={() => {
              if (selectedLeagues.has('Serie A')) {
                const newSet = new Set(selectedLeagues);
                newSet.delete('Serie A');
                if (newSet.size === 0) newSet.add('ALL');
                setSelectedLeagues(newSet);
              } else {
                const newSet = new Set(selectedLeagues);
                newSet.delete('ALL');
                newSet.add('Serie A');
                setSelectedLeagues(newSet);
              }
            }}
          >
            <LeagueLogo league="Serie A" /> Serie A
          </button>
        </div>
      </div>

      {loading && <div className="state">Memuat jadwal…</div>}
      {error && <div className="state error">{error}</div>}

      {!loading && !error && (
        <main className="content">
          {/* Team Highlight Section */}
          <div
            className={`team-highlight-section ${
              showTeamHighlight ? '' : 'collapsed'
            }`}
          >
            <div
              className={`team-selector ${showTeamHighlight ? 'expanded' : ''}`}
            >
              <h2>🌟 Highlight Tim</h2>
              <div className="highlight-controls">
                <SearchableSelect
                  value={selectedTeam}
                  onChange={setSelectedTeam}
                  options={allTeams}
                  placeholder="Pilih tim untuk melihat jadwal..."
                  className="team-dropdown"
                />
                <button
                  className="toggle-highlight-btn"
                  onClick={() => setShowTeamHighlight(!showTeamHighlight)}
                >
                  {showTeamHighlight ? '😑 Hide' : '👁️ Show'}
                </button>
              </div>
            </div>

            {showTeamHighlight && selectedTeam && teamMatches.length > 0 && (
              <div className="team-matches">
                <h3>4 Pertandingan Terdekat - {selectedTeam}</h3>
                <div className="matches-grid">
                  {teamMatches.map((match) => (
                    <MatchCard
                      key={`team-${match.league}-${match.id}`}
                      match={match}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* League Sections */}
          {groupedMatches.map(([leagueName, allLeagueMatches]) => {
            const filteredMatches = getFilteredLeagueMatches(
              leagueName,
              allLeagueMatches
            );
            const currentPage = leaguePages[leagueName] || 1;
            const totalPages = Math.ceil(
              filteredMatches.length / MATCHES_PER_PAGE
            );
            const startIndex = (currentPage - 1) * MATCHES_PER_PAGE;
            const displayMatches = filteredMatches.slice(
              startIndex,
              startIndex + MATCHES_PER_PAGE
            );

            return (
              <div key={leagueName} className="league-section">
                <div className="league-header">
                  <h2 className="league-title">
                    <LeagueLogo league={leagueName} /> {leagueName}
                  </h2>
                  <span className="match-count">
                    {filteredMatches.length} pertandingan
                  </span>
                </div>

                {/* League Search and Status Filters */}
                <div className="league-controls">
                  <div className="league-search">
                    <div className="search-input">
                      <span className="search-icon">🔍</span>
                      <input
                        type="text"
                        placeholder={`Cari tim di ${leagueName}...`}
                        value={leagueSearchQueries[leagueName] || ''}
                        onChange={(e) =>
                          setLeagueSearchQueries((prev) => ({
                            ...prev,
                            [leagueName]: e.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>

                  <div className="status-filters">
                    <button
                      className={`status-filter ${
                        (leagueStatusFilters[leagueName] || 'ALL') === 'ALL'
                          ? 'active'
                          : ''
                      }`}
                      onClick={() =>
                        setLeagueStatusFilters((prev) => ({
                          ...prev,
                          [leagueName]: 'ALL',
                        }))
                      }
                    >
                      Semua
                    </button>
                    <button
                      className={`status-filter ${
                        leagueStatusFilters[leagueName] === 'LIVE'
                          ? 'active'
                          : ''
                      }`}
                      onClick={() =>
                        setLeagueStatusFilters((prev) => ({
                          ...prev,
                          [leagueName]: 'LIVE',
                        }))
                      }
                    >
                      Live
                    </button>
                    <button
                      className={`status-filter ${
                        leagueStatusFilters[leagueName] === 'FINISHED'
                          ? 'active'
                          : ''
                      }`}
                      onClick={() =>
                        setLeagueStatusFilters((prev) => ({
                          ...prev,
                          [leagueName]: 'FINISHED',
                        }))
                      }
                    >
                      FT
                    </button>
                  </div>
                </div>

                {filteredMatches.length === 0 ? (
                  <div className="no-matches">
                    {(() => {
                      const statusFilter =
                        leagueStatusFilters[leagueName] || 'ALL';
                      const searchQuery = (
                        leagueSearchQueries[leagueName] || ''
                      ).trim();

                      if (searchQuery && statusFilter !== 'ALL') {
                        // Both search and status filter active
                        const statusText =
                          statusFilter === 'LIVE' ? 'live' : 'selesai (FT)';
                        return `Tidak ada pertandingan ${statusText} untuk "${searchQuery}" di ${leagueName}`;
                      } else if (searchQuery) {
                        // Only search filter active
                        return `Tim "${searchQuery}" tidak ditemukan di ${leagueName}`;
                      } else if (statusFilter === 'LIVE') {
                        // Only live filter active
                        return `Tidak ada pertandingan ${leagueName} live saat ini`;
                      } else if (statusFilter === 'FINISHED') {
                        // Only finished filter active
                        return `Tidak ada pertandingan ${leagueName} yang sudah selesai (FT)`;
                      } else {
                        // Default message
                        return `Tidak ada pertandingan ${leagueName} saat ini`;
                      }
                    })()}
                  </div>
                ) : (
                  <>
                    <div className="matches-grid">
                      {displayMatches.map((match) => (
                        <MatchCard
                          key={`${match.league}-${match.id}`}
                          match={match}
                        />
                      ))}
                    </div>

                    <Pagination
                      currentPage={currentPage}
                      totalPages={totalPages}
                      onPageChange={(page) =>
                        setLeaguePages((prev) => ({
                          ...prev,
                          [leagueName]: page,
                        }))
                      }
                    />
                  </>
                )}
              </div>
            );
          })}

          {groupedMatches.length === 0 && (
            <div className="state">Tidak ada pertandingan pada filter ini.</div>
          )}
        </main>
      )}
      <footer className="footer">
        Zona waktu: WIB (UTC+7). Status Live diasumsikan ±2 jam dari kick-off.
      </footer>
    </div>
  );
}
