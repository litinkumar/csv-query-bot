export interface DeepDiveOption {
  id: string;
  title: string;
  description: string;
  type: 'quarterly' | 'assignment' | 'regional';
}

export class DeepDiveService {
  static analyzeQueryContext(query: string, entities: string[], intent: string): DeepDiveOption[] {
    const queryLower = query.toLowerCase();
    const options: DeepDiveOption[] = [];

    // Check for quarterly/time-related context
    const hasTimeContext = entities.some(entity => 
      /q[1-4]|quarter|quarterly|time|trend|month|year/i.test(entity)
    ) || /quarter|time|trend|monthly|yearly|over time|q[1-4]/i.test(queryLower);

    // Check for assignment/spend tier context  
    const hasAssignmentContext = entities.some(entity =>
      /assignment|spend|tier|status/i.test(entity)
    ) || /assignment|spend|tier|status/i.test(queryLower);

    // Check for regional context
    const hasRegionalContext = entities.some(entity =>
      /(americas|europe|asia|africa|region|country|geographic)/i.test(entity)
    ) || /(americas|europe|asia|africa|region|country|geographic)/i.test(queryLower);

    // Always suggest contextually relevant deep dives
    if (hasTimeContext) {
      options.push({
        id: 'quarterly',
        title: 'Quarterly Deep-Dive',
        description: 'View quarterly trends across deliveries, opens, clicks, and adoptions',
        type: 'quarterly'
      });
    }

    if (hasAssignmentContext) {
      options.push({
        id: 'assignment',
        title: 'Assignment Status Deep-Dive', 
        description: 'Explore assignment status distribution with spend tier breakdown',
        type: 'assignment'
      });
    }

    if (hasRegionalContext) {
      options.push({
        id: 'regional',
        title: 'Regional Deep-Dive',
        description: 'Compare performance across different regions',
        type: 'regional'
      });
    }

    // If no specific context, suggest based on intent
    if (options.length === 0) {
      // Default suggestions based on common analysis patterns
      if (/performance|metric|funnel|conversion/i.test(intent)) {
        options.push(
          {
            id: 'quarterly',
            title: 'Quarterly Deep-Dive',
            description: 'View quarterly trends across deliveries, opens, clicks, and adoptions',
            type: 'quarterly'
          },
          {
            id: 'regional',
            title: 'Regional Deep-Dive', 
            description: 'Compare performance across different regions',
            type: 'regional'
          }
        );
      }
    }

    return options.slice(0, 3); // Limit to 3 options max
  }

  static generateQuarterlySQL(entities: string[]): string {
    // Extract program and region filters from entities
    const programFilter = entities.find(e => /asg|lwp|primary|path/i.test(e));
    const regionFilter = entities.find(e => /(americas|europe|asia|africa)/i.test(e));

    let whereClause = "WHERE 1=1";
    
    if (programFilter) {
      whereClause += ` AND program_name_1 ILIKE '%${programFilter}%'`;
    }
    
    if (regionFilter) {
      whereClause += ` AND acq_region_1 ILIKE '%${regionFilter}%'`;
    }

    return `
      SELECT 
        send_date_quarter_1 as quarter,
        SUM(customers_1) as deliveries,
        SUM(CASE WHEN funnel_order_1 >= 2 THEN customers_1 ELSE 0 END) as opens,
        SUM(CASE WHEN funnel_order_1 >= 3 THEN customers_1 ELSE 0 END) as clicks,
        SUM(CASE WHEN funnel_order_1 >= 4 THEN customers_1 ELSE 0 END) as adoptions
      FROM sample_engagement_data 
      ${whereClause}
      GROUP BY send_date_quarter_1 
      ORDER BY send_date_quarter_1
    `;
  }

  static generateAssignmentSQL(entities: string[]): string {
    const programFilter = entities.find(e => /asg|lwp|primary|path/i.test(e));
    const regionFilter = entities.find(e => /(americas|europe|asia|africa)/i.test(e));

    let whereClause = "WHERE 1=1";
    
    if (programFilter) {
      whereClause += ` AND program_name_1 ILIKE '%${programFilter}%'`;
    }
    
    if (regionFilter) {
      whereClause += ` AND acq_region_1 ILIKE '%${regionFilter}%'`;
    }

    return `
      SELECT 
        assignment_status_1 as assignment_status,
        spend_tier_grouped_1 as spend_tier,
        SUM(customers_1) as count
      FROM sample_engagement_data 
      ${whereClause}
      GROUP BY assignment_status_1, spend_tier_grouped_1 
      ORDER BY assignment_status_1, spend_tier_grouped_1
    `;
  }

  static generateRegionalSQL(entities: string[]): string {
    const programFilter = entities.find(e => /asg|lwp|primary|path/i.test(e));
    const quarterFilter = entities.find(e => /q[1-4]/i.test(e));

    let whereClause = "WHERE 1=1";
    
    if (programFilter) {
      whereClause += ` AND program_name_1 ILIKE '%${programFilter}%'`;
    }
    
    if (quarterFilter) {
      whereClause += ` AND send_date_quarter_1 = '${quarterFilter.toUpperCase()}'`;
    }

    return `
      SELECT 
        acq_region_1 as region,
        SUM(customers_1) as deliveries,
        SUM(CASE WHEN funnel_order_1 >= 2 THEN customers_1 ELSE 0 END) as opens,
        SUM(CASE WHEN funnel_order_1 >= 3 THEN customers_1 ELSE 0 END) as clicks,
        SUM(CASE WHEN funnel_order_1 >= 4 THEN customers_1 ELSE 0 END) as adoptions
      FROM sample_engagement_data 
      ${whereClause}
      GROUP BY acq_region_1 
      ORDER BY deliveries DESC
    `;
  }
}