import { supabase } from "@/lib/supabase";

export interface Message {
  id: string;
  expediteur_id: string;
  destinataire_id: string;
  livraison_id?: string;
  contenu: string;
  created_at: string;
  lu: boolean;
}

export interface Conversation {
  interlocuteur_id: string;
  interlocuteur_nom: string;
  dernier_message: string;
  dernier_message_date: string;
  messages_non_lus: number; // renommé pour cohérence avec les pages
}

class CommunicationService {

  /**
   * Envoie un message entre deux utilisateurs.
   */
  async sendMessage(
    expediteurId: string,
    destinataireId: string,
    contenu: string,
    livraisonId?: string
  ): Promise<Message> {
    const { data, error } = await supabase
      .from("messages")
      .insert({
        expediteur_id: expediteurId,
        destinataire_id: destinataireId,
        livraison_id: livraisonId ?? null,
        contenu,
      })
      .select()
      .single();

    if (error) {
      console.error("[CommunicationService] sendMessage:", error);
      throw new Error("Impossible d'envoyer le message.");
    }
    return data;
  }

  /**
   * Récupère tous les messages d'une conversation entre deux utilisateurs.
   * livraisonId est optionnel — si absent, récupère tous les messages entre les deux users.
   */
  async getConversation(
    userId1: string,
    userId2: string,
    livraisonId?: string
  ): Promise<Message[]> {
    let query = supabase
      .from("messages")
      .select("*")
      .or(
        `and(expediteur_id.eq.${userId1},destinataire_id.eq.${userId2}),and(expediteur_id.eq.${userId2},destinataire_id.eq.${userId1})`
      )
      .order("created_at", { ascending: true });

    if (livraisonId) {
      query = query.eq("livraison_id", livraisonId);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[CommunicationService] getConversation:", error);
      throw new Error("Impossible de récupérer la conversation.");
    }
    return data || [];
  }

  /**
   * Marque les messages reçus comme lus.
   */
  async markMessagesAsRead(
    destinataireId: string,
    expediteurId: string,
    livraisonId?: string
  ): Promise<void> {
    let query = supabase
      .from("messages")
      .update({ lu: true })
      .eq("expediteur_id", expediteurId)
      .eq("destinataire_id", destinataireId)
      .eq("lu", false);

    if (livraisonId) {
      query = query.eq("livraison_id", livraisonId);
    }

    const { error } = await query;

    if (error) {
      console.error("[CommunicationService] markMessagesAsRead:", error);
      // On ne throw pas ici pour ne pas bloquer l'UI
    }
  }

  /**
   * Récupère la liste des conversations d'un utilisateur.
   * Alias getUserConversations pour compatibilité.
   */
  async getUserConversations(userId: string): Promise<Conversation[]> {
    return this.getConversationsList(userId);
  }

  async getConversationsList(userId: string): Promise<Conversation[]> {
    const { data: messages, error } = await supabase
      .from("messages")
      .select(
        `*,
        expediteur:expediteur_id(id, nom, avatar_url),
        destinataire:destinataire_id(id, nom, avatar_url)`
      )
      .or(`expediteur_id.eq.${userId},destinataire_id.eq.${userId}`)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[CommunicationService] getConversationsList:", error);
      throw new Error("Impossible de récupérer la liste des conversations.");
    }

    const conversationsMap = new Map<string, Conversation>();

    for (const msg of messages || []) {
      const isExpéditeur = msg.expediteur_id === userId;
      const interlocuteur = isExpéditeur ? msg.destinataire : msg.expediteur;
      const interlocuteurId: string | undefined = interlocuteur?.id;

      if (!interlocuteurId) continue;

      if (!conversationsMap.has(interlocuteurId)) {
        const nonLusCount = (messages || []).filter(
          (m: Message) =>
            m.expediteur_id === interlocuteurId &&
            m.destinataire_id === userId &&
            !m.lu
        ).length;

        conversationsMap.set(interlocuteurId, {
          interlocuteur_id: interlocuteurId,
          interlocuteur_nom: interlocuteur?.nom ?? "Inconnu",
          dernier_message: msg.contenu,
          dernier_message_date: msg.created_at,
          messages_non_lus: nonLusCount,
        });
      }
    }

    return Array.from(conversationsMap.values());
  }

  /**
   * Génère un lien WhatsApp pour le Burkina Faso (+226 par défaut).
   */
  getWhatsAppLink(phoneNumber: string): string {
    const cleaned = phoneNumber.replace(/\D/g, "");
    const international = cleaned.startsWith("226") ? cleaned : `226${cleaned}`;
    return `https://wa.me/${international}`;
  }
}

export const communicationService = new CommunicationService();
