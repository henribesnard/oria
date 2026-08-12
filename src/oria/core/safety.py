"""Filtres de securite -- detection jeu problematique et injection de prompt."""

from __future__ import annotations

import re

_GAMBLING_DISTRESS_RE = re.compile(
    r"\b(tout\s+perdu|me\s+refaire|perdu\s+tout\s+mon\s+argent|"
    r"j[''']arr[eê]te\s+pas\s+de\s+perdre|addiction|addict[eé]|"
    r"plus\s+d[''']argent|ruin[eé]|endett[eé]|"
    r"joueur\s+compulsif|besoin\s+d[''']aide\s+jeu|je\s+suis\s+accroc)",
    re.IGNORECASE,
)

_INJECTION_RE = re.compile(
    r"(ignore\s+(tes|les|ces|toutes?\s+les?)\s+instructions?|"
    r"oublie\s+(tes|les|ces|tout|toutes?\s+les?)\s*(r[eè]gles?|instructions?|consignes?|directives?)?|"
    r"tu\s+es\s+maintenant|"
    r"new\s+system\s+prompt|"
    r"</?(?:system|user|assistant)>|"
    r"SYSTEM\s*:|"
    r"jailbreak|DAN\s+mode|"
    r"r[eé]pond[s]?\s+sans\s+(?:filtre|limite|restriction)|"
    r"affiche\s+(?:ton|le)\s+(?:system\s+)?prompt)",
    re.IGNORECASE,
)

GAMBLING_HELP_RESPONSE = (
    "Je comprends que tu traverses un moment difficile. "
    "Si tu ressens le besoin de parler de ta relation au jeu, "
    "voici des ressources qui peuvent t'aider :\n\n"
    "- **Joueurs Info Service** : 09 74 75 13 13 (appel non surtaxe)\n"
    "- **adictel.com** : aide en ligne 24h/24\n"
    "- **SOS Joueurs** : 09 69 39 55 12\n\n"
    "Tu n'es pas seul. N'hesite pas a demander de l'aide."
)

INJECTION_RESPONSE = (
    "Je suis Oria, un assistant football. "
    "Je ne peux pas modifier mes instructions. "
    "Comment puis-je t'aider avec le football ?"
)


def detect_gambling_distress(text: str) -> bool:
    """Renvoie True si le texte contient des signaux de detresse liee au jeu."""
    return bool(_GAMBLING_DISTRESS_RE.search(text))


def detect_injection(text: str) -> bool:
    """Renvoie True si le texte contient des patterns d'injection de prompt."""
    return bool(_INJECTION_RE.search(text))
