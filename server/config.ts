import dotenv from "dotenv";

dotenv.config();

export interface BackendConfig {
  gemini: {
    apiKey: string | undefined;
    model: string;
  };
  finnhub: {
    apiKey: string | undefined;
    provider: "finnhub" | "mock";
  };
  alphaVantage: {
    apiKey: string | undefined;
    provider: "alphavantage" | "mock";
  };
  newsIo: {
    apiKey: string | undefined;
    provider: "newsdata" | "mock";
  };
  fred: {
    apiKey: string | undefined;
    provider: "fred" | "mock";
  };
  alternateMe: {
    apiKey: string | undefined;
    provider: "alternate.me" | "mock";
  };
  coinGecko: {
    apiKey: string | undefined;
  };
  financialModeling: {
    apiKey: string | undefined;
    provider: "financialmodeling" | "mock";
  };
}

// Read and normalize keys strictly from specified environment variables
const finnhubKey = process.env.FINNHUB_API;
const alphaVantageKey = process.env.ALPHA_VANTAGE_A;
const newsIoKey = process.env.NEWS_IO_API || process.env["NEWS.IO_API"] || process.env.NEWS_IO;
const fredKey = process.env.FRED_API;
const alternateMeKey = process.env.ALTERNATE_ME_API || process.env["ALTERNATE.ME_API"];
const financialModelingKey = process.env.FINANCIAL_MODELING_API || process.env["FINANCIAL-MODELING_API"];

export const config: BackendConfig = {
  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_MODEL || "gemini-3.5-flash",
  },
  coinGecko: {
    apiKey: process.env.COINGECKO_API
  },
  finnhub: {
    apiKey: finnhubKey,
    provider: finnhubKey ? "finnhub" : "mock",
  },
  alphaVantage: {
    apiKey: alphaVantageKey,
    provider: alphaVantageKey ? "alphavantage" : "mock",
  },
  newsIo: {
    apiKey: newsIoKey,
    provider: newsIoKey ? "newsdata" : "mock",
  },
  fred: {
    apiKey: fredKey,
    provider: fredKey ? "fred" : "mock",
  },
  alternateMe: {
    apiKey: alternateMeKey,
    // Note: fear and greed can run with mock or work with free public endpoint without key too
    provider: "alternate.me", 
  },
  financialModeling: {
    apiKey: financialModelingKey,
    provider: financialModelingKey ? "financialmodeling" : "mock",
  },
};

/**
 * Validates that an API key is present for the requested provider.
 * Logs healthy diagnostics info.
 */
export function validateProviderConfig(
  group: string,
  provider: string,
  key: string | undefined
): void {
  if (provider !== "mock" && !key) {
    console.log(
      `[Diagnostics] Provider designated for "${group}" is "${provider}", but its API key is undefined. Dynamic fallback to mock datasets is active.`
    );
  }
}
