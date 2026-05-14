# Registro de Horas — Deploy en Vercel

## Estructura
```
registro-horas/
├── api/
│   └── humand.js      ← proxy seguro (la API key vive acá, en Vercel)
├── public/
│   └── index.html     ← interfaz completa
└── vercel.json        ← config de rutas
```

## Deploy (una sola vez)

### 1. Instalar Vercel CLI
```bash
npm install -g vercel
```

### 2. Ir a la carpeta del proyecto
```bash
cd registro-horas
```

### 3. Deploy
```bash
vercel
```
Seguí los pasos:
- Set up and deploy? → Y
- Which scope? → tu cuenta
- Link to existing project? → N
- Project name → registro-horas (o el que quieras)
- Directory → ./
- Override settings? → N

### 4. Agregar la API key como variable de entorno segura
```bash
vercel env add HUMAND_API_KEY
```
Cuando te pregunte el valor, pegá:
```
ODI4MTE5Mjo2SHlmZXlYdGl5bkZtbHl3WlZMSGtvMm5tZ1k0ZE1fcg==
```
Seleccioná los entornos: Production, Preview, Development

### 5. Re-deploy para que tome la variable
```bash
vercel --prod
```

Vercel te da una URL tipo:
```
https://registro-horas-xxxx.vercel.app
```

Esa URL es la que usa el cliente. Nada más que instalar.

## Actualizar el código
Cada vez que modifiques algo:
```bash
vercel --prod
```

## Probar local (opcional)
```bash
vercel dev
```
La app corre en http://localhost:3000
