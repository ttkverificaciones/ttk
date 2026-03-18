/**
 * API centralizada para verificação de pagamento
 *
 * Este arquivo pode ser incluído em qualquer página de pagamento
 * e sempre usará os endpoints centralizados
 */

(function () {
  "use strict";

  // Detecta o caminho base baseado na estrutura de pastas
  function getBasePath() {
    const path = window.location.pathname;

    // Remove a barra inicial e divide o path
    const parts = path.split("/").filter((p) => p);

    // Se está em uma subpasta (upsell1/pagamento/, upsell2/pagamento/, etc)
    if (path.includes("/upsell") && path.includes("/pagamento/")) {
      // Conta quantos níveis acima precisa subir para chegar na raiz
      // Exemplo: /TikTokPay/upsell1/pagamento/index.html
      // parts = ['TikTokPay', 'upsell1', 'pagamento', 'index.html']
      // Precisa subir 2 níveis (../..) para chegar em TikTokPay/
      // Depois adiciona 'pagamento/'
      const upsellIndex = parts.findIndex((p) => p.startsWith("upsell"));
      if (upsellIndex !== -1) {
        // Se está em upsellX/pagamento/, precisa subir 2 níveis
        return "../../pagamento/";
      }
    }

    // Se está em uma pasta upsell (sem /pagamento/)
    // Exemplo: /TikTokPay/upsell/index.html ou /TikTokPay/upsell1/index.html
    if (path.includes("/upsell") && !path.includes("/pagamento/")) {
      // Precisa subir 1 nível (../) para chegar na raiz
      // Depois adiciona 'pagamento/'
      return "../pagamento/";
    }

    // Se está na pasta pagamento raiz (não dentro de upsell)
    // Exemplo: /TikTokPay/pagamento/index.html
    if (path.includes("/pagamento/") && !path.includes("/upsell")) {
      return "";
    }

    // Fallback: assume que está na raiz e precisa ir para pagamento/
    return "pagamento/";
  }

  const BASE_PATH = getBasePath();

  /**
   * Verifica o status de um pagamento
   * @param {string} transactionId - ID da transação
   * @param {string|null} paymentId - ID do pagamento (opcional)
   * @returns {Promise} Promise com os dados do pagamento
   */
  window.verifyPayment = function (transactionId, paymentId = null) {
    const urlParams = new URLSearchParams(window.location.search);
    const utmParams = {};

    // Captura parâmetros UTM
    [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
    ].forEach((key) => {
      if (urlParams.has(key)) {
        utmParams[key] = urlParams.get(key);
      }
    });

    const requestData = {
      id: transactionId,
      ...(paymentId && { payment_id: paymentId }),
      ...(Object.keys(utmParams).length > 0 && { utmQuery: utmParams }),
    };

    const verifyUrl = BASE_PATH + "verifyPayment.php";

    console.log("📤 Verificando pagamento:", {
      url: verifyUrl,
      data: requestData,
    });

    return fetch(verifyUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestData),
    })
      .then((response) => {
        if (!response.ok) {
          return response.text().then((text) => {
            throw new Error(`HTTP ${response.status}: ${text}`);
          });
        }
        return response.json();
      })
      .then((data) => {
        console.log("📥 Resposta da verificação:", data);
        return data;
      })
      .catch((error) => {
        console.error("❌ Erro ao verificar pagamento:", error);
        throw error;
      });
  };

  /**
   * Verifica se o pagamento está pago
   * @param {Object} data - Dados retornados pela verificação
   * @returns {boolean}
   */
  window.isPaymentPaid = function (data) {
    return (
      data.paid === true ||
      data.status === "completed" ||
      data.status === "COMPLETED" ||
      data.status === "paid" ||
      data.status === "PAID" ||
      data.status === "approved" ||
      data.status === "APPROVED" ||
      data.status === "confirmado" ||
      data.status === "CONFIRMADO" ||
      data.status === "aprovado" ||
      data.status === "APROVADO" ||
      data.status === "pago" ||
      data.status === "PAGO"
    );
  };

  /**
   * Identifica qual produto/upsell baseado na URL
   * @returns {string} Identificador do produto (ex: 'upsell1', 'upsell3', 'pagamento')
   */
  function identifyProductFromUrl() {
    const path = window.location.pathname;
    const match = path.match(/\/upsell(\d+)\//);
    if (match) {
      return "upsell" + match[1];
    }
    // Detecta upsell sem número (pasta upsell/)
    if (path.match(/\/upsell\//) && !path.match(/\/upsell\d+\//)) {
      return "upsell";
    }
    if (path.includes("/pagamento/") && !path.includes("/upsell")) {
      return "pagamento";
    }
    return "pagamento"; // fallback
  }

  /**
   * Extrai ttclid da URL ou de outras fontes com backup de 7 dias
   * @returns {string|null} TikTok Click ID ou null
   */
  function getTtclidFromUrl() {
    let ttclid = null;

    // 1. URL atual
    const urlParams = new URLSearchParams(window.location.search);
    ttclid = urlParams.get("ttclid") || urlParams.get("click_id");

    if (ttclid) {
      console.log("🔗 ttclid encontrado na URL:", ttclid);
      // Salva para uso futuro
      try {
        localStorage.setItem("last_ttclid", ttclid);
        localStorage.setItem("last_ttclid_timestamp", Date.now().toString());
      } catch (e) {}
      return ttclid;
    }

    // 2. localStorage (utm_params)
    try {
      const storedUtm = localStorage.getItem("utm_params");
      if (storedUtm) {
        const utmData = JSON.parse(storedUtm);
        ttclid = utmData.ttclid || utmData.click_id;
        if (ttclid) {
          console.log(
            "🔗 ttclid encontrado em localStorage (utm_params):",
            ttclid,
          );
          return ttclid;
        }
      }
    } catch (e) {}

    // 3. sessionStorage
    try {
      const sessionUtm = sessionStorage.getItem("utm_params");
      if (sessionUtm) {
        const utmData = JSON.parse(sessionUtm);
        ttclid = utmData.ttclid || utmData.click_id;
        if (ttclid) {
          console.log("🔗 ttclid encontrado em sessionStorage:", ttclid);
          return ttclid;
        }
      }
    } catch (e) {}

    // 4. localStorage direto (last_ttclid) - com validade de 7 dias
    try {
      const lastTtclid = localStorage.getItem("last_ttclid");
      const lastTimestamp = localStorage.getItem("last_ttclid_timestamp");
      if (lastTtclid && lastTimestamp) {
        const age = Date.now() - parseInt(lastTimestamp);
        const sevenDays = 7 * 24 * 60 * 60 * 1000;
        if (age < sevenDays) {
          console.log(
            "🔗 ttclid recuperado de backup (idade: " +
              Math.floor(age / 1000 / 60 / 60) +
              "h):",
            lastTtclid,
          );
          return lastTtclid;
        } else {
          console.log(
            "⏰ ttclid backup expirado (>" +
              Math.floor(age / 1000 / 60 / 60 / 24) +
              " dias)",
          );
        }
      }
    } catch (e) {}

    // 5. Tenta extrair de document.referrer se vier do TikTok
    if (document.referrer && document.referrer.includes("tiktok.com")) {
      try {
        const referrerUrl = new URL(document.referrer);
        ttclid = referrerUrl.searchParams.get("ttclid");
        if (ttclid) {
          console.log("🔗 ttclid encontrado no referrer:", ttclid);
          localStorage.setItem("last_ttclid", ttclid);
          localStorage.setItem("last_ttclid_timestamp", Date.now().toString());
          return ttclid;
        }
      } catch (e) {}
    }

    console.warn(
      "⚠️ ttclid não encontrado em nenhuma fonte. Evento será enviado sem atribuição de campanha.",
    );
    return null;
  }

  /**
   * Mapeia identificador de produto para content_id do TikTok
   * @param {string} productIdentifier - Identificador do produto
   * @returns {string} Content ID do TikTok
   */
  function getContentIdForProduct(productIdentifier) {
    const productMap = {
      pagamento: "tiktokpay_main",
      upsell: "tiktokpay_upsell",
      upsell1: "tiktokpay_upsell1",
      upsell3: "tiktokpay_upsell3",
      upsell4: "tiktokpay_upsell4",
      upsell5: "tiktokpay_upsell5",
      upsell6: "tiktokpay_upsell6",
      upsell7: "tiktokpay_upsell7",
      upsell8: "tiktokpay_upsell8",
      upsell9: "tiktokpay_upsell9",
      upsell10: "tiktokpay_upsell10",
    };
    return productMap[productIdentifier] || "tiktokpay_main";
  }

  /**
   * Função para hash SHA-256 (para dados PII)
   * @param {string} message - Mensagem para hash
   * @returns {Promise<string>} Hash SHA-256 em hexadecimal
   */
  async function sha256(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return hashHex;
  }

  /**
   * Captura o IP do usuário usando serviço público com cache de 10 minutos
   * @returns {Promise<string|null>} IP do usuário ou null se falhar
   */
  async function getUserIPCached() {
    try {
      const key = "cached_ipify";
      const tsKey = "cached_ipify_ts";
      const cached = sessionStorage.getItem(key);
      const ts = Number(sessionStorage.getItem(tsKey) || 0);

      // Se tem cache e tem menos de 10 minutos (600000ms)
      if (cached && Date.now() - ts < 10 * 60 * 1000) {
        console.log("🌐 IP recuperado do cache:", cached);
        return cached;
      }

      // Buscar novo IP
      const r = await fetch("https://api.ipify.org?format=json", {
        cache: "no-store",
      });
      const j = await r.json();

      // Salvar no cache
      sessionStorage.setItem(key, j.ip);
      sessionStorage.setItem(tsKey, String(Date.now()));

      console.log("🌐 IP capturado e cacheado:", j.ip);
      return j.ip;
    } catch {
      console.warn("⚠️ Erro ao obter IP, continuando sem IP");
      return null;
    }
  }

  /**
   * Captura o User-Agent do navegador
   * @returns {string} User-Agent do navegador
   */
  function getUserAgent() {
    return navigator.userAgent;
  }

  /**
   * Fetch com timeout usando AbortController
   * @param {string} url - URL para fazer o fetch
   * @param {Object} options - Opções do fetch
   * @param {number} timeout - Timeout em milissegundos (padrão: 10000)
   * @returns {Promise<Response>}
   */
  async function fetchWithTimeout(url, options = {}, timeout = 10000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === "AbortError") {
        throw new Error("Request timeout");
      }
      throw error;
    }
  }

  /**
   * Fetch com retry automático
   * @param {string} url - URL para fazer o fetch
   * @param {Object} options - Opções do fetch
   * @param {number} retries - Número de tentativas (padrão: 2)
   * @returns {Promise<Response>}
   */
  async function fetchWithRetry(url, options = {}, retries = 2) {
    let lastError;

    for (let i = 0; i <= retries; i++) {
      try {
        const response = await fetchWithTimeout(url, options);
        return response;
      } catch (error) {
        lastError = error;
        if (i < retries) {
          console.warn(
            `[TikTok] Tentativa ${i + 1} falhou, retentando...`,
            error.message,
          );
          await new Promise((resolve) => setTimeout(resolve, 1000)); // Aguarda 1s
        }
      }
    }

    throw lastError;
  }

  /**
   * Constrói payload para eventos do TikTok
   * @param {string} event - Nome do evento ("InitiateCheckout" ou "Purchase")
   * @param {string} suffix - Sufixo do event_id ("_IC" ou "_PUR")
   * @param {Object} options - Opções do evento
   * @returns {Promise<Object>} Payload completo
   */
  async function buildTikTokPayload(event, suffix, options) {
    // Identifica produto automaticamente se não fornecido
    const productIdentifier = identifyProductFromUrl();
    const contentId =
      options.contentId || getContentIdForProduct(productIdentifier);

    // Converte contentId para o nome legível do produto
    const contentName = getContentNameForProduct(contentId);

    // Captura ttclid, IP e User-Agent
    const ttclid = getTtclidFromUrl();
    const userIP = await getUserIPCached();
    const userAgent = getUserAgent();

    // Hash dos dados PII
    const hashedEmail = options.customer?.email
      ? await sha256(options.customer.email.toLowerCase().trim())
      : null;
    const hashedPhone = options.customer?.phone
      ? await sha256(options.customer.phone.replace(/\D/g, ""))
      : null;
    const hashedDocument = options.customer?.document
      ? await sha256(String(options.customer.document).trim())
      : null;

    // Monta o payload no formato da API do TikTok
    return {
      event_source: "web",
      event_source_id: "D5TSTQBC77U2HKOKTI7G",
      data: [
        {
          event: event,
          event_time: Math.floor(Date.now() / 1000),
          event_id: options.transactionId
            ? options.transactionId + suffix
            : null,
          user: {
            email: hashedEmail,
            phone: hashedPhone,
            external_id: hashedDocument,
            ttclid: ttclid,
            ip: userIP,
            user_agent: userAgent,
          },
          properties: {
            currency: options.currency || "BRL",
            value: parseFloat(options.amount) || 0,
            content_type: "product",
            contents: [
              {
                content_id: contentName,
                content_type: "product",
                quantity: 1,
                price: parseFloat(options.amount) || 0,
              },
            ],
          },
        },
      ],
    };
  }

  /**
   * Mapeia content_id para content_name (nome do produto)
   * @param {string} contentId - Content ID do produto
   * @returns {string} Nome do produto
   */
  function getContentNameForProduct(contentId) {
    const nameMap = {
      tiktokpay_main: "Verificação de Identidade",
      tiktokpay_discount: "Verificação com Desconto",
      tiktokpay_upsell: "Serviço Premium 1",
      tiktokpay_upsell1: "Serviço Premium 2",
      tiktokpay_upsell3: "Serviço Premium 3",
      tiktokpay_upsell4: "Serviço Premium 4",
      tiktokpay_upsell5: "Serviço Premium 5",
      tiktokpay_upsell6: "Serviço Premium 6",
      tiktokpay_upsell7: "Serviço Premium 7",
      tiktokpay_upsell8: "Serviço Premium 8",
      tiktokpay_upsell9: "Serviço Premium 9",
      tiktokpay_upsell10: "Serviço Premium 10",
    };
    return nameMap[contentId] || "Produto TikTokPay";
  }

  /**
   * Dispara evento InitiateCheckout do TikTok via API (N8N)
   * @param {Object} options - Opções do evento
   * @param {string} options.transactionId - ID da transação
   * @param {number} options.amount - Valor em reais
   * @param {Object} options.customer - Dados do cliente {email, phone, name, document}
   * @param {string} [options.contentId] - Content ID do produto (opcional, será detectado automaticamente)
   * @param {string} [options.contentName] - Nome do produto (opcional, será detectado automaticamente)
   */
  window.trackTikTokInitiateCheckout = async function (options) {
    try {
      // Validação de amount
      if (!options.amount || options.amount <= 0) {
        console.warn(
          "[TikTok][IC] Event não enviado: amount inválido",
          options.amount,
        );
        return;
      }

      // Constrói payload
      const payload = await buildTikTokPayload(
        "InitiateCheckout",
        "_IC",
        options,
      );
      console.log("[TikTok][IC]", payload);

      // Envia para o N8N com retry
      const response = await fetchWithRetry(
        "https://n8n.tiklo.shop/webhook/0f4f9fbf-8b94-41dd-a246-110132f2dd9a",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );

      if (response.ok) {
        const result = await response.json();
        console.log("[TikTok][IC] Sucesso:", result);
      } else {
        console.error(
          "[TikTok][IC] Erro:",
          response.status,
          response.statusText,
        );
      }
    } catch (error) {
      console.error("[TikTok][IC] Falha:", error);
    }
  };

  /**
   * Dispara evento Purchase do TikTok via API (N8N)
   * @param {Object} options - Opções do evento
   * @param {string} options.transactionId - ID da transação
   * @param {number} options.amount - Valor em reais
   * @param {Object} [options.customer] - Dados do cliente {email, phone, name, document}
   * @param {string} [options.contentId] - Content ID do produto (opcional, será detectado automaticamente)
   * @param {string} [options.contentName] - Nome do produto (opcional, será detectado automaticamente)
   */
  window.trackTikTokPurchase = async function (options) {
    try {
      // Validação de amount
      if (!options.amount || options.amount <= 0) {
        console.warn(
          "[TikTok][PUR] Event não enviado: amount inválido",
          options.amount,
        );
        return;
      }

      // Constrói payload
      const payload = await buildTikTokPayload("Purchase", "_PUR", options);
      console.log("[TikTok][PUR]", payload);

      // Envia para o N8N com retry
      const response = await fetchWithRetry(
        "https://n8n.tiklo.shop/webhook/0f4f9fbf-8b94-41dd-a246-110132f2dd9a",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );

      if (response.ok) {
        const result = await response.json();
        console.log("[TikTok][PUR] Sucesso:", result);
      } else {
        console.error(
          "[TikTok][PUR] Erro:",
          response.status,
          response.statusText,
        );
      }
    } catch (error) {
      console.error("[TikTok][PUR] Falha:", error);
    }
  };

  console.log("✅ Payment API carregada. Base path:", BASE_PATH);
})();
