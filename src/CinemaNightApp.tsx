import React, { useEffect, useState } from "react";

/**
 * Cinema Night – con sessione di voto
 *
 * Flusso:
 * - Chi avvia una votazione sceglie un film e lo "attiva".
 * - Tutti gli utenti connessi vedono subito quel film e possono votare.
 * - Quando si preme "Termina votazione", il film con i voti finisce nello Storico.
 * - Se non c'è votazione attiva, la tab Vota mostra la ricerca.
 */
