const express = require('express');
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

const urlBase = 'https://xamacardoso.github.io/Buscardoso-ProgWeb/';
const caminhoArquivo = path.join(__dirname, 'pagina.json');

// Rota principal que inicia o scraping
app.get('/executar', async (req, res) => {
  fs.writeFileSync(caminhoArquivo, '[]', 'utf-8');
  const visitadas = new Set();
  const resultados = [];

  const browser = await puppeteer.launch({
    headless: 'new', // necessário para funcionar em nuvens como Railway
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  async function visitarPagina(url) {
    if (visitadas.has(url)) return;
    visitadas.add(url);

    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2' });

    const dados = await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll('a'));

      const links = anchors
        .map(a => a.getAttribute('href'))
        .filter(href => href && href.endsWith('.html'));

      const nomePagina = location.pathname.split('/').pop() || 'home.html';
      const nomesSimples = links.map(href => href.split('/').pop()).filter(nome => nome !== nomePagina);

      return {
        nome: nomePagina,
        info: {
          linksPara: nomesSimples,
          linksReais: links,
          conteudo: document.documentElement.outerHTML
        }
      };
    });

    resultados.push({
      url,
      nome: dados.nome,
      info: {
        linksPara: dados.info.linksPara,
        conteudo: dados.info.conteudo
      }
    });

    const linksAbsolutos = dados.info.linksReais.map(href =>
      new URL(href, url).href
    );

    for (const link of linksAbsolutos) {
      await visitarPagina(link);
    }

    await page.close();
  }

  await visitarPagina(urlBase);
  await browser.close();

  fs.writeFileSync(caminhoArquivo, JSON.stringify(resultados, null, 2), 'utf-8');

  res.json({ mensagem: 'Scraping finalizado com sucesso!', arquivo: '/pagina.json' });
});

// Servir o arquivo JSON publicamente
app.use('/pagina.json', express.static(caminhoArquivo));

// Página inicial simples
app.get('/', (req, res) => {
  res.send(`<h1>Scraper online</h1><p>Acesse <a href="/executar">/executar</a> para rodar o scraper.</p>`);
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
