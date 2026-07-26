// Oria media resolver — maps entities to API-Football CDN assets.
// In production these ids/URLs come straight from the API-Football payload
// (team.logo, league.logo, player.photo). Here we resolve by known id so the
// prototype shows the real crests/photos, with a monogram fallback on miss.
const CDN = 'https://media.api-sports.io/football';

const TEAM_ID = {
  'Paris SG':85,'PSG':85,'Le Havre':111,'LEH':111,'Marseille':81,'OM':81,'Monaco':91,'ASM':91,
  'Lyon':80,'OL':80,'Lille':79,'LOSC':79,'LIL':79,'Angers':77,'Grenoble':1063,
  'Man City':50,'MCI':50,'Arsenal':42,'ARS':42,'Liverpool':40,'LIV':40,'Chelsea':49,'CHE':49,
  'Leeds':63,'Southampton':41,'Real Madrid':541,'RMA':541,'Barcelona':529,'FCB':529,
  'Atlético':530,'ATM':530,'Girona':547,'GIR':547,'Inter':505,'INT':505,'Juventus':496,'JUV':496,
  'Milan':489,'MIL':489,'Napoli':492,'NAP':492,
};
const LEAGUE_ID = {
  'Ligue 1':61,'Ligue 2':62,'Premier League':39,'Championship':40,'LaLiga':140,
  'Serie A':135,'Bundesliga':78,'Champions League':2,
};
const PLAYER_ID = {
  'Mbappé':278,'Haaland':1100,'Dembélé':2060,'Barcola':22105,'Vitinha':61931,
  'Marquinhos':5,'Greenwood':19220,'Harit':1150,'Foden':1485,'Bellingham':1120,
  'Yamal':400500,'Raphinha':1467,'Lautaro':30439,'Barella':5155,
};

const MEDIA = {
  team:  (name) => TEAM_ID[name]   != null ? `${CDN}/teams/${TEAM_ID[name]}.png`     : null,
  league:(name) => LEAGUE_ID[name] != null ? `${CDN}/leagues/${LEAGUE_ID[name]}.png` : null,
  player:(name) => PLAYER_ID[name] != null ? `${CDN}/players/${PLAYER_ID[name]}.png` : null,
};

if (typeof window !== 'undefined') window.OriaMedia = MEDIA;
if (typeof module !== 'undefined') module.exports = { MEDIA, TEAM_ID, LEAGUE_ID, PLAYER_ID };
