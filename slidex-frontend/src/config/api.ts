const DEFAULT_SERVER_IP = '192.168.176.177';
const PORT = '3000';

/**
 * Odczytuje zapisane IP z localStorage lub zwraca domyślne.
 */
export const getSavedServerIp = (): string => {
    return localStorage.getItem('SCANNER_SERVER_IP') || DEFAULT_SERVER_IP;
};

/**
 * Dynamicznie buduje aktualny adres URL do API przy każdym wywołaniu.
 */
export const getApiBaseUrl = (): string => {
    let ip = getSavedServerIp().trim();

    // Usuwamy prefiksy http:// lub https:// gdyby użytkownik wpisał je ręcznie
    ip = ip.replace(/^https?:\/\//, '');

    // Jeśli użytkownik wpisał w formularzu IP z portem (np. "10.237.121.225:3000"), nie dublujemy portu
    const formattedIp = ip.includes(':') ? ip : `${ip}:${PORT}`;

    return `http://${formattedIp}`;
};

/**
 * Getter sprawiający, że odwołanie do API_BASE_URL zawsze zwraca aktualne IP,
 * nawet w komponentach, które używają samej stałej API_BASE_URL.
 */
export const API_BASE_URL = getApiBaseUrl();